var ServerApi = require("../index").ServerApi;

//Load the API
ServerApi.load("http://localhost:1966/testapi").then(async api => {
  try {
    console.log("Client delay() is:", JSON.stringify(await api.delay(100)));
    console.log("Client always.hello() is:", JSON.stringify(await api.always.hello()));
    console.log("Client delay(-1) is:", JSON.stringify(await api.delay(-1)));
  } catch (ex) {
    console.log("Client error:", ex.message);
  }
});
