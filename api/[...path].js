const { createApp } = require("../server/appFactory");

const app = createApp();

module.exports = (req, res) => {
  app(req, res);
};
