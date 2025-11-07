const { createApp, HAS_UPSTASH_CONFIG } = require("./server/appFactory");

const PORT = process.env.PORT || 3000;
const app = createApp();

app.listen(PORT, () => {
  if (!HAS_UPSTASH_CONFIG) {
    console.warn(
      "Upstash configuration missing. Set UPSTASH_REST_URL and UPSTASH_REST_TOKEN to enable persistence."
    );
  }
  console.log(`WantYou server listening on port ${PORT}`);
});
