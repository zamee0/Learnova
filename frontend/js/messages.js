document.addEventListener("DOMContentLoaded", async () => {
  const user = checkAuth();
  if (!user) return;
  renderNavigation("messages");

  const convList = document.getElementById("conversationList");
  const msgBox = document.getElementById("chatMessages");
  const form = document.getElementById("sendMessageForm");
  const chatHeader = document.getElementById("activeChatUser");
  let activeUserId = null;
  let lastMessageId = 0;
  const socket = io({ auth: { token: localStorage.getItem('token') } });
  let typingTimer;
  socket.on('dm:message', message => {
    if (activeUserId && (message.sender_id === activeUserId || message.receiver_id === activeUserId)) window.openChat(activeUserId, chatHeader.textContent).catch(() => {});
    loadConversations().catch(() => {});
  });
  socket.on('dm:typing', data => {
    if (data.from === activeUserId) document.getElementById('typingStatus').textContent = data.is_typing ? 'Typing…' : '';
  });
  socket.on('dm:read', data => {
    if (data.by === activeUserId) document.querySelectorAll('.outgoing .read-state').forEach(x => x.textContent = 'Read');
  });
  socket.on('presence', () => loadConversations().catch(() => {}));
  socket.on('connect', async () => {
    const queued = JSON.parse(localStorage.getItem('pendingMessages') || '[]');
    for (const item of queued) {
      try { await apiFetch('/messages', { method: 'POST', body: JSON.stringify(item) }); queued.shift(); localStorage.setItem('pendingMessages', JSON.stringify(queued)); }
      catch { break; }
    }
  });

  async function loadConversations() {
    const convs = await apiFetch("/messages");
    if (!convs.length) {
      convList.innerHTML = "<p style='padding:1rem; color:var(--gray-500); font-size:0.85rem;'>No active chats.</p>";
      return;
    }
    convList.innerHTML = convs.map(c => `
      <div class="chat-user-item ${activeUserId === c.other_user_id ? 'active' : ''}" data-user="${escapeHtml(c.other_user_name)}" onclick="openChat(${c.other_user_id}, this.dataset.user)">
        <div>
          <strong>${c.other_user_name}</strong> <small>${c.is_online ? '● Online' : 'Offline'}</small> ${c.unread_count ? `<span class="badge badge-primary">${c.unread_count} unread</span>` : ''}
          <p style="font-size:0.8rem; color:var(--gray-500); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(c.last_message)}</p>
        </div>
      </div>
    `).join("");
  }

  window.openChat = async function(otherId, name) {
    activeUserId = otherId;
    chatHeader.textContent = name;
    msgBox.innerHTML = "Loading messages...";

    const msgs = await apiFetch(`/messages/${otherId}`);
    msgBox.innerHTML = msgs.map(m => `
      <div class="message-bubble ${m.sender_id === user.id ? 'outgoing' : 'incoming'}">
        <div>${escapeHtml(m.content)}</div>
        <div style="font-size:0.7rem; opacity:0.75; margin-top:0.25rem;">${formatDate(m.created_at)} ${m.sender_id === user.id ? `<span class="read-state">${m.is_read ? 'Read' : 'Sent'}</span>` : ''}</div>
      </div>
    `).join("");
    msgBox.scrollTop = msgBox.scrollHeight;
    lastMessageId = msgs.length ? msgs[msgs.length - 1].id : 0;
    socket.emit('dm:read', { from: otherId });
  };

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!activeUserId) { alert("Please select a conversation first."); return; }
    const input = document.getElementById("messageInput");
    const payload = { receiver_id: activeUserId, content: input.value.trim() };
    try { await apiFetch("/messages", { method: "POST", body: JSON.stringify(payload) }); }
    catch (err) {
      if (!navigator.onLine || !socket.connected) {
        const queued = JSON.parse(localStorage.getItem('pendingMessages') || '[]'); queued.push(payload); localStorage.setItem('pendingMessages', JSON.stringify(queued)); input.value = ''; alert('Message queued until you reconnect.'); return;
      }
      alert(err.message);
      return;
    }
    input.value = "";
    openChat(activeUserId, chatHeader.textContent);
    loadConversations();
  });
  document.getElementById('messageInput')?.addEventListener('input', () => {
    if (!activeUserId) return;
    socket.emit('dm:typing', { to: activeUserId, is_typing: true });
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => socket.emit('dm:typing', { to: activeUserId, is_typing: false }), 900);
  });

  loadConversations();
  // Polling keeps the existing REST app live without adding a socket server dependency.
  setInterval(async () => {
    try {
      await loadConversations();
      if (activeUserId) {
        const latest = await apiFetch(`/messages/${activeUserId}`);
        if ((latest.at(-1)?.id || 0) !== lastMessageId) window.openChat(activeUserId, chatHeader.textContent);
      }
    } catch (err) { document.getElementById('typingStatus').textContent = 'Reconnecting…'; }
  }, 5000);
  const initialId = new URLSearchParams(location.search).get('id');
  if (initialId) { const friend = (await apiFetch('/friends')).find(f => f.id === Number(initialId)); if (friend) window.openChat(friend.id, friend.name); }
});
