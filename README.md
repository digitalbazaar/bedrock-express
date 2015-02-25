# bedrock-express

A [bedrock][] module that integrates [express][] with [bedrock][] to provide
a routing framework and other features for writing Web applications. It
uses the [bedrock][] event system to emit a number of configuration
events that dependent modules may use to add features to a core [express][]
server.

## Quick Examples

```
npm install bedrock-express
```

```js
var bedrock = require('bedrock');

bedrock.events.on('bedrock-express.configure.routes', addRoutes);

function addRoutes(app) {
  app.get('/', function(req, res) {
    res.send('Hello World!');
  });
}

TODO
```

## Configuration

TODO

## How It Works

TODO

[bedrock]: https://github.com/digitalbazaar/bedrock
[express]: https://github.com/strongloop/express
