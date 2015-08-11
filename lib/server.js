var http = require("http");
var express = require("express");
var createGzipStatic = require('connect-static');

function main() {
  var app = express();
  createGzipStatic({dir:"public"}, function(err, middleware) {
    if (err) throw err;
    app.use(middleware);
    var httpServer = http.createServer(app);
    httpServer.listen(25407, "127.0.0.1", function(err) {
      console.log("serving: http://127.0.0.1:25407/");
    });
  });
}

main();
