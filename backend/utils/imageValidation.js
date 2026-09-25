function validImageDataUrl(value, maxBytes = 4 * 1024 * 1024) {
  const match = typeof value === 'string' && /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/i.exec(value);
  if (!match) return false;
  const bytes = Buffer.from(match[2], 'base64');
  if (bytes.length > maxBytes) return false;
  if (match[1].toLowerCase() === 'jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (match[1].toLowerCase() === 'png') return bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'));
  return bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
}

module.exports = { validImageDataUrl };
