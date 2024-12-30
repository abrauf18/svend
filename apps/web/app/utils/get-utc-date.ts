export default function getUTCDate(date: string) {
  const dateObj = new Date(date);

  return `${dateObj.getUTCMonth() + 1}/${dateObj.getUTCDate()}/${dateObj.getUTCFullYear()}`;
}
