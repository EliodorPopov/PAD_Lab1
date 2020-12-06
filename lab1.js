var net = require("net");
var { fork } = require("child_process");
var server = net.createServer();

if (!process.argv[2]) {
  console.log('No port specified')
  process.exit();
}

server.listen(process.argv[2], "127.0.0.1");
console.log('Cache is running on port ' + process.argv[2]);
server.on("connection", handleConnection);

var data = { cache: {}, ttl: {} };
var clients = [];

//cache expiration verification
setInterval(() => {
  const childProcess = fork("./handler.js");
  childProcess.send({ data, message: "REK" });
  childProcess.on("message", (response) => {
    data = response.data;
  });
}, 5000);

function handleConnection(conn) {
  var remoteAddress = conn.remoteAddress + ":" + conn.remotePort;
  console.log("new client connection from %s", remoteAddress);

  conn.on("data", onConnData);
  conn.once("close", onConnClose);
  conn.on("error", onConnError);

  function onConnData(d) {
    console.log(`connection data from ${remoteAddress}: ${d}`);
    var authRes = processAuth(remoteAddress, d.toString());
    if (authRes === "authorised") {
      const childProcess = fork("./handler.js");
      childProcess.send({ data, message: d.toString() });
      childProcess.on("message", (response) => {
        conn.write(response.message + "\n");
        data = response.data;
      });
    } else {
      conn.write(authRes + "\n");
    }
  }
  function onConnClose() {
    console.log("connection from %s closed", remoteAddress);
    clients = clients.splice(clients.indexOf(remoteAddress, 1));
  }
  function onConnError(err) {
    console.log("Connection %s error: %s", remoteAddress, err.message);
  }
}

function authenticate(remoteAddress, login, pass) {
  if (login === "shefu" && pass === "!") {
    clients.push(remoteAddress);
    return 1;
  } else {
    return 0;
  }
}

function processAuth(remoteAddress, message) {
  message = message.replace(/(\r\n|\n|\r)/gm, "");
  const args = message.split(" ").filter((a) => a !== "\n");
  var command = args.shift().toUpperCase();
  if (command === "AUTH") {
    if (authenticate(remoteAddress, args[0], args[1])) {
      return "successful authentication";
    } else {
      return "incorrect credentials";
    }
  } else if (clients.indexOf(remoteAddress) > -1) {
    return "authorised";
  } else {
    return `unauthorised, please use 'AUTH <login> <pass>' to authenticate`;
  }
}
