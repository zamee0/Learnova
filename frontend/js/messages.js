document.addEventListener("DOMContentLoaded", async () => {
  const user = checkAuth();
  if (!user) return;
  renderNavigation("messages");

  const conversationList = document.getElementById("conversationList");
  const chatMessages = document.getElementById("chatMessages");
  const messageInput = document.getElementById("messageInput");
  const sendMessageForm = document.getElementById("sendMessageForm");
  const activeChatUser = document.getElementById("activeChatUser");

  let selectedUserId = null;

  async function loadConversations() {
    try {
      const messages = await apiFetch("/messages");
      if (!messages || messages.length === 0) {
        conversationList.innerHTML = `<p style="padding:1rem; color:var(--gray-500);">No messages yet.</p>`;
        return;
      }

      conversationList.innerHTML = messages.map(m => `
        <div class="chat-user-item ${selectedUserId === m.other_user_id ? 'active' : ''}" onclick="openChat(${m.other_user_id}, '${m.other_user_name || 'User'}')">
          <div class="avatar">${getInitials(m.other_user_name || 'U')}</div>
          <div>
            <strong>${m.other_user_name || 'User'}</strong>
            <p style="font-size:0.8rem; color:var(--gray-500);">${m.last_message || ''}</p>
          </div>
        </div>
      `).join("");
    } catch (err) {
      conversationList.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
    }
  }

  window.openChat = async function(otherId, name) {
    selectedUserId = otherId;
    activeChatUser.textContent = name;
    chatMessages.innerHTML = `<div class="spinner"></div>`;

    try {
      const messages = await apiFetch(`/messages/${otherId}`);
      chatMessages.innerHTML = messages.map(m => `
        <div class="message-bubble ${m.sender_id === user.id ? 'outgoing' : 'incoming'}">
          <div>${m.content}</div>
          <div style="font-size:0.7rem; opacity:0.75; margin-top:0.25rem;">${formatDate(m.created_at)}</div>
        </div>
      `).join("");
      chatMessages.scrollTop = chatMessages.scrollHeight;
    } catch (err) {
      chatMessages.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
    }
  };

  sendMessageForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!selectedUserId) {
      alert("Please select a conversation first");
      return;
    }

    const content = messageInput.value.trim();
    if (!content) return;

    try {
      await apiFetch("/messages", {
        method: "POST",
        body: JSON.stringify({ receiver_id: selectedUserId, content })
      });
      messageInput.value = "";
      openChat(selectedUserId, activeChatUser.textContent);
      loadConversations();
    } catch (err) {
      alert(err.message);
    }
  });

  loadConversations();
});