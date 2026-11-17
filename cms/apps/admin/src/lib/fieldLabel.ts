/** The label of a field: the one given in the content type, else its name written as words ("linkedinUrl" becomes "Linkedin url"). */
export function fieldLabel(f: { name: string; label?: string }): string {
  if (f.label) return f.label;
  const words = f.name.replace(/[_-]+/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
