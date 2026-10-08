const encoder = new TextEncoder();

// Membandingkan hash SHA-256 keduanya, sehingga waktu tidak bergantung pada panjang atau isi sandi.
export async function safeEqual(a: string, b: string): Promise<boolean> {
  const [left, right] = await Promise.all(
    [a, b].map(async (value) => new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)))),
  );
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}
