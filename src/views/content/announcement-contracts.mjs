export const announcementPayload = (title, content) => {
  if (!title.trim() || !content.trim()) throw new Error("title and content are required");
  return { title: title.trim(), content: content.trim() };
};
