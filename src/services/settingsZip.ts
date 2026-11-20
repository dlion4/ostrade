// Stored ZIP files (no compression), with UTF-8 filenames and per-entry CRC-32.
export function settingsZip(files: Record<string, unknown>) {
  const encoder = new TextEncoder(),
    chunks: Uint8Array<ArrayBuffer>[] = [],
    directory: Uint8Array<ArrayBuffer>[] = [];
  let offset = 0,
    directorySize = 0;
  const crc32 = (bytes: Uint8Array) => {
    let c = 0xffffffff;
    for (const b of bytes) {
      c ^= b;
      for (let j = 0; j < 8; j++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
    }
    return (c ^ 0xffffffff) >>> 0;
  };
  for (const [name, data] of Object.entries(files)) {
    const label = encoder.encode(name),
      body = encoder.encode(JSON.stringify(data, null, 2)),
      crc = crc32(body);
    const local = new Uint8Array(30 + label.length),
      l = new DataView(local.buffer);
    l.setUint32(0, 0x04034b50, true);
    l.setUint16(4, 20, true);
    l.setUint16(6, 0x800, true);
    l.setUint16(12, 33, true);
    l.setUint32(14, crc, true);
    l.setUint32(18, body.length, true);
    l.setUint32(22, body.length, true);
    l.setUint16(26, label.length, true);
    local.set(label, 30);
    const central = new Uint8Array(46 + label.length),
      c = new DataView(central.buffer);
    c.setUint32(0, 0x02014b50, true);
    c.setUint16(4, 20, true);
    c.setUint16(6, 20, true);
    c.setUint16(8, 0x800, true);
    c.setUint16(14, 33, true);
    c.setUint32(16, crc, true);
    c.setUint32(20, body.length, true);
    c.setUint32(24, body.length, true);
    c.setUint16(28, label.length, true);
    c.setUint32(42, offset, true);
    central.set(label, 46);
    chunks.push(local, body);
    directory.push(central);
    offset += local.length + body.length;
    directorySize += central.length;
  }
  const tail = new Uint8Array(22),
    e = new DataView(tail.buffer);
  e.setUint32(0, 0x06054b50, true);
  e.setUint16(8, directory.length, true);
  e.setUint16(10, directory.length, true);
  e.setUint32(12, directorySize, true);
  e.setUint32(16, offset, true);
  return new Blob([...chunks, ...directory, tail], { type: "application/zip" });
}
