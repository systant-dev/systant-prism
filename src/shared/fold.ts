/** Lower case and without accents, so "cafe" finds "Café". */
export function fold(text: string) {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase()
}
