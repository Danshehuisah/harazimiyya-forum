async function loadNotifications(userId) {
  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  const list = document.getElementById("notificationList");
  list.innerHTML = "";

  data.forEach(n => {
    const item = document.createElement("div");
    item.className = "notification-item";
    item.innerHTML = `<strong>${n.title}</strong><p>${n.message}</p>`;
    list.appendChild(item);
  });
}
