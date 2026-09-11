const app = require("./app");
require("dotenv").config();

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(`Learnova Backend running at:`);
  console.log(`http://localhost:${PORT}`);
  console.log(`=========================================`);
});
