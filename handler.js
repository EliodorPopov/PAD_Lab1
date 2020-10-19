var data = { cache: {}, ttl: {} };
var cache = {};
var ttl = {};

process.on("message", (message) => {
  data = message.data;
  cache = data.cache;
  ttl = data.ttl;
  var m = handle(message.message);
  process.send({ message: m, data });
  process.exit();
});

function handle(message) {
  message = message.replace(/(\r\n|\n|\r)/gm, "");
  const args = message.split(" ").filter((a) => a !== "\n");
  var command = args.shift().toUpperCase();
  let response = "";
  try {
    switch (command) {
      case "SET":
        var key = args.shift();
        set(key, args.join(' '));
        response = "success";
        break;
      case "GET":
        response = get(args[0]);
        break;
      case "SETNX":
        setnx(args[0], args[1]);
        response = "success";
        break;
      case "MGET":
        response = mget(args);
        break;
      case "DEL":
        del(args);
        response = "success";
        break;
      case "INCR":
        response = incr(args[0]);
        break;
      case "LLEN":
        response = llen(args[0]);
        break;
      case "LREM":
        response = `removed ${lrem(args[0], args[1], args[2])} items`;
        break;
      case "LPUSH":
        response = lpush(args[0], args[1]);
        break;
      case "RPOPLPUSH":
        response = rpoplpush(args[0], args[1]);
        break;
      case "LRANGE":
        response = lrange(args[0], args[1], args[2]);
        break;
      case "EXPIRE":
        response = expire(args[0], args[1]);
        response = "success";
        break;
      case "TTL":
        response = ttlFun(args[0]);
        break;
      default:
        response = `Unknown command: ${command}`;
        break;
    }
  } catch (e) {
    response = `An error occured: ${e}`;
  }
  return response;
}

function set(key, value) {
  cache[key] = value;
}

function get(key) {
  var key = cache[key];
  return key == undefined ? "not found" : key;
}

function setnx(key, value) {
  if (!cache[key]) {
    cache[key] = value;
  }
}

function mget(keys) {
  return keys
    .filter((key) => cache[key])
    .map((key) => `${key}: ${cache[key]}`)
    .join("\n");
}

function del(keys) {
  keys.forEach((key) => {
    delete cache[key];
  });
}

function incr(key) {
  var number = parseInt(cache[key]) || 0;
  number++;
  cache[key] = number;
  return number;
}

function llen(key) {
  return getList(key).length;
}

function lrange(key, start, finish) {
  var list = getList(key);
  return list.slice(start, finish);
}

function lrem(key, count, item) {
  var list = getList(key);
  var removedCount = 0;
  while (count > 0) {
    var index = list.indexOf(item);
    if (index > 0) {
      list = list.splice(index, 1);
      removedCount++;
    } else {
      continue;
    }
    count--;
  }
  cache[key] = list;
  return removedCount;
}

function lpush(key, value) {
  var list = getList(key);
  list.unshift(value);
  cache[key] = list;
  return list.length;
}

function rpoplpush(key1, key2) {
  var list1 = getList(key1);
  var list2 = getList(key2);
  var item = list1.pop();
  list2.unshift(item);
  cache[key1] = list1;
  cache[key2] = list2;
  return item;
}

function expire(key, seconds) {
  if (!cache[key]) {
    return 0;
  }
  ttl[key] = Math.round(new Date().getTime() / 1000 + parseInt(seconds));
}

function ttlFun(key) {
  if (!cache[key]) {
    return -2;
  }
  if (!ttl[key]) {
    return -1;
  }
  return Math.round(ttl[key] - new Date().getTime() / 1000);
}

function removeExpiredKeys() {
  var keys = Object.keys(ttl);

  keys.forEach((key) => {
    if (new Date().getTime() / 1000 - seconds < 0) {
      delete cache[key];
      delete ttl[key];
    }
  });
}

function getList(key) {
  var list = cache[key] || [];
  if (!Array.isArray(list)) {
    throw "Not an array";
  }
  return list;
}
