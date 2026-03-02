const channel = supabase.channel("presence");

channel
  .on("presence", { event: "sync" }, () => {
    console.log("Online users:", channel.presenceState());
  })
  .subscribe(async status => {
    if (status === "SUBSCRIBED") {
      await channel.track({ online: true });
    }
  });
