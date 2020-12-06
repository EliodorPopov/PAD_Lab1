var net = require("net");

const clientPorts = ["2000", "2001", "2002"];
const hostName = "127.0.0.1";
var clients = [];
const dataArray = [];
var masterDown = false;

clientPorts.forEach((p) => {
  dataArray.push({ port: p });
});

setInterval(() => {
  if (masterDown) {
    var c = net.Socket();
    c.connect(clientPorts[0], hostName, () => {
      masterDown = false;
      c.destroy();
      clients.forEach((cl) => {
        try {
          cl.emit("goToMaster");
        } catch {}
      });
    });
    c.on("error", () => {});
    c.destroy();
  }
}, 5000);

setInterval(() => {
  var portsToGet = [];
  if (masterDown) {
    portsToGet = clientPorts.slice(1);
  } else {
    portsToGet = [clientPorts[0]];
  }
  console.log(portsToGet);
  portsToGet.forEach((p) => {
    var c = net.Socket();
    c.connect(p, hostName, () => {
      c.write("getData");
    });
    c.on("error", () => {
      c.destroy();
    });
    c.on("data", (data) => {
      var d = dataArray.find((x) => x.port === p);
      datas = data.toString();
      var timeStamp = datas.slice(0, datas.indexOf(":"));
      var data = datas.slice(datas.indexOf(":") + 1);
      d.timeStamp = timeStamp;
      d.data = data;
      c.destroy();
    });
  });
}, 5000);
setTimeout(() => {
  setInterval(() => {
    console.log(dataArray);
    if (!dataArray.length) {
      return;
    }
    var latest = dataArray.sort((a, b) =>
      a.timeStamp < b.timeStamp ? 1 : -1
    )[0];
    var inSync =
      dataArray.filter((x) => x.timeStamp === dataArray[0].timeStamp).length ===
      dataArray.length;
    if (inSync || !latest.data) {
      return;
    }
    console.log("latest:" + latest.port);
    clientPorts
      .filter((p) => p !== latest.port)
      .forEach((p) => {
        dataArray.find((x) => x.port === p).timeStamp = latest.timeStamp;
        var c = net.Socket();
        c.connect(p, hostName, () => {
          c.write("setData:" + latest.data);
        });
        c.on("error", () => {});
        c.on("data", (data) => {
          c.destroy();
        });
      });
  }, 5000);
}, 5000);

function connectClient(client, portIndex) {
  client.connect(clientPorts[portIndex], hostName, () => {
    console.log("Connected to port " + clientPorts[portIndex]);
    client.write("auth shefu !");
  });
}

function setOnError(client, portIndex) {
  client.once("error", (ex) => {
    console.log(client.remotePort + ": " + ex.toString());
    if (portIndex === 0) {
      masterDown = true;
    }
    setTimeout(() => {
      if (!clientPorts[portIndex + 1]) {
        portIndex = -1;
      }
      client.destroy();
      connectClient(client, portIndex + 1);
      setOnError(client, portIndex + 1);
    }, 1000);
  });

  client.on("goToMaster", () => {
    client.destroy();
    connectClient(client, 0);
    setOnError(client, 0);
  });
}

function setOnData(client, connection) {
  client.on("data", (data) => {
    connection.write(data);
  });
}

function processOnData(data) {
  console.log("t");
}

var server = net.createServer();

server.listen(1999, hostName);
console.log("Cache is running...");
server.on("connection", (conn) => {
  var remoteAddress = conn.remoteAddress + ":" + conn.remotePort;
  console.log("new client connection from %s", remoteAddress);

  conn.on("data", onConnData);
  conn.once("close", onConnClose);
  conn.on("error", onConnError);

  var c = net.Socket();
  clients.push(remoteAddress);
  connectClient(c, 0);
  setOnError(c, 0);
  setOnData(c, conn);

  function onConnData(d) {
    console.log(`connection data from ${remoteAddress}: ${d}`);
    c.write(d.toString());
  }
  function onConnClose() {
    console.log("connection from %s closed", remoteAddress);
    clients = clients.splice(clients.indexOf(remoteAddress, 1));
  }
  function onConnError(err) {
    console.log("Connection %s error: %s", remoteAddress, err.message);
  }
});

server.on("error", (ex) => {
  console.log(ex.toString());
  process.exit();
});
