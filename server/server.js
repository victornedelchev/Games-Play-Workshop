(function (global, factory) {
  typeof exports === "object" && typeof module !== "undefined"
    ? (module.exports = factory(
        require("http"),
        require("fs"),
        require("crypto")
      ))
    : typeof define === "function" && define.amd
    ? define(["http", "fs", "crypto"], factory)
    : ((global =
        typeof globalThis !== "undefined" ? globalThis : global || self),
      (global.Server = factory(global.http, global.fs, global.crypto)));
})(this, function (http, fs, crypto) {
  "use strict";

  function _interopDefaultLegacy(e) {
    return e && typeof e === "object" && "default" in e ? e : { default: e };
  }

  var http__default = /*#__PURE__*/ _interopDefaultLegacy(http);
  var fs__default = /*#__PURE__*/ _interopDefaultLegacy(fs);
  var crypto__default = /*#__PURE__*/ _interopDefaultLegacy(crypto);

  class ServiceError extends Error {
    constructor(message = "Service Error") {
      super(message);
      this.name = "ServiceError";
    }
  }

  class NotFoundError extends ServiceError {
    constructor(message = "Resource not found") {
      super(message);
      this.name = "NotFoundError";
      this.status = 404;
    }
  }

  class RequestError extends ServiceError {
    constructor(message = "Request error") {
      super(message);
      this.name = "RequestError";
      this.status = 400;
    }
  }

  class ConflictError extends ServiceError {
    constructor(message = "Resource conflict") {
      super(message);
      this.name = "ConflictError";
      this.status = 409;
    }
  }

  class AuthorizationError extends ServiceError {
    constructor(message = "Unauthorized") {
      super(message);
      this.name = "AuthorizationError";
      this.status = 401;
    }
  }

  class CredentialError extends ServiceError {
    constructor(message = "Forbidden") {
      super(message);
      this.name = "CredentialError";
      this.status = 403;
    }
  }

  var errors = {
    ServiceError,
    NotFoundError,
    RequestError,
    ConflictError,
    AuthorizationError,
    CredentialError,
  };

  const { ServiceError: ServiceError$1 } = errors;

  function createHandler(plugins, services) {
    return async function handler(req, res) {
      const method = req.method;
      console.info(`<< ${req.method} ${req.url}`);

      // Redirect fix for admin panel relative paths
      if (req.url.slice(-6) == "/admin") {
        res.writeHead(302, {
          Location: `http://${req.headers.host}/admin/`,
        });
        return res.end();
      }

      let status = 200;
      let headers = {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      };
      let result = "";
      let context;

      // NOTE: the OPTIONS method results in undefined result and also it never processes plugins - keep this in mind
      if (method == "OPTIONS") {
        Object.assign(headers, {
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Credentials": false,
          "Access-Control-Max-Age": "86400",
          "Access-Control-Allow-Headers":
            "X-Requested-With, X-HTTP-Method-Override, Content-Type, Accept, X-Authorization, X-Admin",
        });
      } else {
        try {
          context = processPlugins();
          await handle(context);
        } catch (err) {
          if (err instanceof ServiceError$1) {
            status = err.status || 400;
            result = composeErrorObject(err.code || status, err.message);
          } else {
            // Unhandled exception, this is due to an error in the service code - REST consumers should never have to encounter this;
            // If it happens, it must be debugged in a future version of the server
            console.error(err);
            status = 500;
            result = composeErrorObject(500, "Server Error");
          }
        }
      }

      res.writeHead(status, headers);
      if (
        context != undefined &&
        context.util != undefined &&
        context.util.throttle
      ) {
        await new Promise((r) => setTimeout(r, 500 + Math.random() * 500));
      }
      res.end(result);

      function processPlugins() {
        const context = { params: {} };
        plugins.forEach((decorate) => decorate(context, req));
        return context;
      }

      async function handle(context) {
        const { serviceName, tokens, query, body } = await parseRequest(req);
        if (serviceName == "admin") {
          return ({ headers, result } = services["admin"](
            method,
            tokens,
            query,
            body
          ));
        } else if (serviceName == "favicon.ico") {
          return ({ headers, result } = services["favicon"](
            method,
            tokens,
            query,
            body
          ));
        }

        const service = services[serviceName];

        if (service === undefined) {
          status = 400;
          result = composeErrorObject(
            400,
            `Service "${serviceName}" is not supported`
          );
          console.error("Missing service " + serviceName);
        } else {
          result = await service(context, { method, tokens, query, body });
        }

        // NOTE: logout does not return a result
        // in this case the content type header should be omitted, to allow checks on the client
        if (result !== undefined) {
          result = JSON.stringify(result);
        } else {
          status = 204;
          delete headers["Content-Type"];
        }
      }
    };
  }

  function composeErrorObject(code, message) {
    return JSON.stringify({
      code,
      message,
    });
  }

  async function parseRequest(req) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const tokens = url.pathname.split("/").filter((x) => x.length > 0);
    const serviceName = tokens.shift();
    const queryString = url.search.split("?")[1] || "";
    const query = queryString
      .split("&")
      .filter((s) => s != "")
      .map((x) => x.split("="))
      .reduce(
        (p, [k, v]) => Object.assign(p, { [k]: decodeURIComponent(v) }),
        {}
      );
    const body = await parseBody(req);

    return {
      serviceName,
      tokens,
      query,
      body,
    };
  }

  function parseBody(req) {
    return new Promise((resolve, reject) => {
      let body = "";
      req.on("data", (chunk) => (body += chunk.toString()));
      req.on("end", () => {
        try {
          resolve(JSON.parse(body));
        } catch (err) {
          resolve(body);
        }
      });
    });
  }

  var requestHandler = createHandler;

  class Service {
    constructor() {
      this._actions = [];
      this.parseRequest = this.parseRequest.bind(this);
    }

    /**
     * Handle service request, after it has been processed by a request handler
     * @param {*} context Execution context, contains result of middleware processing
     * @param {{method: string, tokens: string[], query: *, body: *}} request Request parameters
     */
    async parseRequest(context, request) {
      for (let { method, name, handler } of this._actions) {
        if (
          method === request.method &&
          matchAndAssignParams(context, request.tokens[0], name)
        ) {
          return await handler(
            context,
            request.tokens.slice(1),
            request.query,
            request.body
          );
        }
      }
    }

    /**
     * Register service action
     * @param {string} method HTTP method
     * @param {string} name Action name. Can be a glob pattern.
     * @param {(context, tokens: string[], query: *, body: *)} handler Request handler
     */
    registerAction(method, name, handler) {
      this._actions.push({ method, name, handler });
    }

    /**
     * Register GET action
     * @param {string} name Action name. Can be a glob pattern.
     * @param {(context, tokens: string[], query: *, body: *)} handler Request handler
     */
    get(name, handler) {
      this.registerAction("GET", name, handler);
    }

    /**
     * Register POST action
     * @param {string} name Action name. Can be a glob pattern.
     * @param {(context, tokens: string[], query: *, body: *)} handler Request handler
     */
    post(name, handler) {
      this.registerAction("POST", name, handler);
    }

    /**
     * Register PUT action
     * @param {string} name Action name. Can be a glob pattern.
     * @param {(context, tokens: string[], query: *, body: *)} handler Request handler
     */
    put(name, handler) {
      this.registerAction("PUT", name, handler);
    }

    /**
     * Register PATCH action
     * @param {string} name Action name. Can be a glob pattern.
     * @param {(context, tokens: string[], query: *, body: *)} handler Request handler
     */
    patch(name, handler) {
      this.registerAction("PATCH", name, handler);
    }

    /**
     * Register DELETE action
     * @param {string} name Action name. Can be a glob pattern.
     * @param {(context, tokens: string[], query: *, body: *)} handler Request handler
     */
    delete(name, handler) {
      this.registerAction("DELETE", name, handler);
    }
  }

  function matchAndAssignParams(context, name, pattern) {
    if (pattern == "*") {
      return true;
    } else if (pattern[0] == ":") {
      context.params[pattern.slice(1)] = name;
      return true;
    } else if (name == pattern) {
      return true;
    } else {
      return false;
    }
  }

  var Service_1 = Service;

  function uuid() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
      /[xy]/g,
      function (c) {
        let r = (Math.random() * 16) | 0,
          v = c == "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      }
    );
  }

  var util = {
    uuid,
  };

  const uuid$1 = util.uuid;

  const data = fs__default["default"].existsSync("./data")
    ? fs__default["default"].readdirSync("./data").reduce((p, c) => {
        const content = JSON.parse(
          fs__default["default"].readFileSync("./data/" + c)
        );
        const collection = c.slice(0, -5);
        p[collection] = {};
        for (let endpoint in content) {
          p[collection][endpoint] = content[endpoint];
        }
        return p;
      }, {})
    : {};

  const actions = {
    get: (context, tokens, query, body) => {
      tokens = [context.params.collection, ...tokens];
      let responseData = data;
      for (let token of tokens) {
        if (responseData !== undefined) {
          responseData = responseData[token];
        }
      }
      return responseData;
    },
    post: (context, tokens, query, body) => {
      tokens = [context.params.collection, ...tokens];
      console.log("Request body:\n", body);

      // TODO handle collisions, replacement
      let responseData = data;
      for (let token of tokens) {
        if (responseData.hasOwnProperty(token) == false) {
          responseData[token] = {};
        }
        responseData = responseData[token];
      }

      const newId = uuid$1();
      responseData[newId] = Object.assign({}, body, { _id: newId });
      return responseData[newId];
    },
    put: (context, tokens, query, body) => {
      tokens = [context.params.collection, ...tokens];
      console.log("Request body:\n", body);

      let responseData = data;
      for (let token of tokens.slice(0, -1)) {
        if (responseData !== undefined) {
          responseData = responseData[token];
        }
      }
      if (
        responseData !== undefined &&
        responseData[tokens.slice(-1)] !== undefined
      ) {
        responseData[tokens.slice(-1)] = body;
      }
      return responseData[tokens.slice(-1)];
    },
    patch: (context, tokens, query, body) => {
      tokens = [context.params.collection, ...tokens];
      console.log("Request body:\n", body);

      let responseData = data;
      for (let token of tokens) {
        if (responseData !== undefined) {
          responseData = responseData[token];
        }
      }
      if (responseData !== undefined) {
        Object.assign(responseData, body);
      }
      return responseData;
    },
    delete: (context, tokens, query, body) => {
      tokens = [context.params.collection, ...tokens];
      let responseData = data;

      for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        if (responseData.hasOwnProperty(token) == false) {
          return null;
        }
        if (i == tokens.length - 1) {
          const body = responseData[token];
          delete responseData[token];
          return body;
        } else {
          responseData = responseData[token];
        }
      }
    },
  };

  const dataService = new Service_1();
  dataService.get(":collection", actions.get);
  dataService.post(":collection", actions.post);
  dataService.put(":collection", actions.put);
  dataService.patch(":collection", actions.patch);
  dataService.delete(":collection", actions.delete);

  var jsonstore = dataService.parseRequest;

  /*
   * This service requires storage and auth plugins
   */

  const { AuthorizationError: AuthorizationError$1 } = errors;

  const userService = new Service_1();

  userService.get("me", getSelf);
  userService.post("register", onRegister);
  userService.post("login", onLogin);
  userService.get("logout", onLogout);

  function getSelf(context, tokens, query, body) {
    if (context.user) {
      const result = Object.assign({}, context.user);
      delete result.hashedPassword;
      return result;
    } else {
      throw new AuthorizationError$1();
    }
  }

  function onRegister(context, tokens, query, body) {
    return context.auth.register(body);
  }

  function onLogin(context, tokens, query, body) {
    return context.auth.login(body);
  }

  function onLogout(context, tokens, query, body) {
    return context.auth.logout();
  }

  var users = userService.parseRequest;

  const { NotFoundError: NotFoundError$1, RequestError: RequestError$1 } =
    errors;

  var crud = {
    get,
    post,
    put,
    patch,
    delete: del,
  };

  function validateRequest(context, tokens, query) {
    /*
        if (context.params.collection == undefined) {
            throw new RequestError('Please, specify collection name');
        }
        */
    if (tokens.length > 1) {
      throw new RequestError$1();
    }
  }

  function parseWhere(query) {
    const operators = {
      "<=": (prop, value) => (record) => record[prop] <= JSON.parse(value),
      "<": (prop, value) => (record) => record[prop] < JSON.parse(value),
      ">=": (prop, value) => (record) => record[prop] >= JSON.parse(value),
      ">": (prop, value) => (record) => record[prop] > JSON.parse(value),
      "=": (prop, value) => (record) => record[prop] == JSON.parse(value),
      " like ": (prop, value) => (record) =>
        record[prop].toLowerCase().includes(JSON.parse(value).toLowerCase()),
      " in ": (prop, value) => (record) =>
        JSON.parse(`[${/\((.+?)\)/.exec(value)[1]}]`).includes(record[prop]),
    };
    const pattern = new RegExp(
      `^(.+?)(${Object.keys(operators).join("|")})(.+?)$`,
      "i"
    );

    try {
      let clauses = [query.trim()];
      let check = (a, b) => b;
      let acc = true;
      if (query.match(/ and /gi)) {
        // inclusive
        clauses = query.split(/ and /gi);
        check = (a, b) => a && b;
        acc = true;
      } else if (query.match(/ or /gi)) {
        // optional
        clauses = query.split(/ or /gi);
        check = (a, b) => a || b;
        acc = false;
      }
      clauses = clauses.map(createChecker);

      return (record) => clauses.map((c) => c(record)).reduce(check, acc);
    } catch (err) {
      throw new Error("Could not parse WHERE clause, check your syntax.");
    }

    function createChecker(clause) {
      let [match, prop, operator, value] = pattern.exec(clause);
      [prop, value] = [prop.trim(), value.trim()];

      return operators[operator.toLowerCase()](prop, value);
    }
  }

  function get(context, tokens, query, body) {
    validateRequest(context, tokens);

    let responseData;

    try {
      if (query.where) {
        responseData = context.storage
          .get(context.params.collection)
          .filter(parseWhere(query.where));
      } else if (context.params.collection) {
        responseData = context.storage.get(
          context.params.collection,
          tokens[0]
        );
      } else {
        // Get list of collections
        return context.storage.get();
      }

      if (query.sortBy) {
        const props = query.sortBy
          .split(",")
          .filter((p) => p != "")
          .map((p) => p.split(" ").filter((p) => p != ""))
          .map(([p, desc]) => ({ prop: p, desc: desc ? true : false }));

        // Sorting priority is from first to last, therefore we sort from last to first
        for (let i = props.length - 1; i >= 0; i--) {
          let { prop, desc } = props[i];
          responseData.sort(({ [prop]: propA }, { [prop]: propB }) => {
            if (typeof propA == "number" && typeof propB == "number") {
              return (propA - propB) * (desc ? -1 : 1);
            } else {
              return propA.localeCompare(propB) * (desc ? -1 : 1);
            }
          });
        }
      }

      if (query.offset) {
        responseData = responseData.slice(Number(query.offset) || 0);
      }
      const pageSize = Number(query.pageSize) || 10;
      if (query.pageSize) {
        responseData = responseData.slice(0, pageSize);
      }

      if (query.distinct) {
        const props = query.distinct.split(",").filter((p) => p != "");
        responseData = Object.values(
          responseData.reduce((distinct, c) => {
            const key = props.map((p) => c[p]).join("::");
            if (distinct.hasOwnProperty(key) == false) {
              distinct[key] = c;
            }
            return distinct;
          }, {})
        );
      }

      if (query.count) {
        return responseData.length;
      }

      if (query.select) {
        const props = query.select.split(",").filter((p) => p != "");
        responseData = Array.isArray(responseData)
          ? responseData.map(transform)
          : transform(responseData);

        function transform(r) {
          const result = {};
          props.forEach((p) => (result[p] = r[p]));
          return result;
        }
      }

      if (query.load) {
        const props = query.load.split(",").filter((p) => p != "");
        props.map((prop) => {
          const [propName, relationTokens] = prop.split("=");
          const [idSource, collection] = relationTokens.split(":");
          console.log(
            `Loading related records from "${collection}" into "${propName}", joined on "_id"="${idSource}"`
          );
          const storageSource =
            collection == "users" ? context.protectedStorage : context.storage;
          responseData = Array.isArray(responseData)
            ? responseData.map(transform)
            : transform(responseData);

          function transform(r) {
            const seekId = r[idSource];
            const related = storageSource.get(collection, seekId);
            delete related.hashedPassword;
            r[propName] = related;
            return r;
          }
        });
      }
    } catch (err) {
      console.error(err);
      if (err.message.includes("does not exist")) {
        throw new NotFoundError$1();
      } else {
        throw new RequestError$1(err.message);
      }
    }

    context.canAccess(responseData);

    return responseData;
  }

  function post(context, tokens, query, body) {
    console.log("Request body:\n", body);

    validateRequest(context, tokens);
    if (tokens.length > 0) {
      throw new RequestError$1("Use PUT to update records");
    }
    context.canAccess(undefined, body);

    body._ownerId = context.user._id;
    let responseData;

    try {
      responseData = context.storage.add(context.params.collection, body);
    } catch (err) {
      throw new RequestError$1();
    }

    return responseData;
  }

  function put(context, tokens, query, body) {
    console.log("Request body:\n", body);

    validateRequest(context, tokens);
    if (tokens.length != 1) {
      throw new RequestError$1("Missing entry ID");
    }

    let responseData;
    let existing;

    try {
      existing = context.storage.get(context.params.collection, tokens[0]);
    } catch (err) {
      throw new NotFoundError$1();
    }

    context.canAccess(existing, body);

    try {
      responseData = context.storage.set(
        context.params.collection,
        tokens[0],
        body
      );
    } catch (err) {
      throw new RequestError$1();
    }

    return responseData;
  }

  function patch(context, tokens, query, body) {
    console.log("Request body:\n", body);

    validateRequest(context, tokens);
    if (tokens.length != 1) {
      throw new RequestError$1("Missing entry ID");
    }

    let responseData;
    let existing;

    try {
      existing = context.storage.get(context.params.collection, tokens[0]);
    } catch (err) {
      throw new NotFoundError$1();
    }

    context.canAccess(existing, body);

    try {
      responseData = context.storage.merge(
        context.params.collection,
        tokens[0],
        body
      );
    } catch (err) {
      throw new RequestError$1();
    }

    return responseData;
  }

  function del(context, tokens, query, body) {
    validateRequest(context, tokens);
    if (tokens.length != 1) {
      throw new RequestError$1("Missing entry ID");
    }

    let responseData;
    let existing;

    try {
      existing = context.storage.get(context.params.collection, tokens[0]);
    } catch (err) {
      throw new NotFoundError$1();
    }

    context.canAccess(existing);

    try {
      responseData = context.storage.delete(
        context.params.collection,
        tokens[0]
      );
    } catch (err) {
      throw new RequestError$1();
    }

    return responseData;
  }

  /*
   * This service requires storage and auth plugins
   */

  const dataService$1 = new Service_1();
  dataService$1.get(":collection", crud.get);
  dataService$1.post(":collection", crud.post);
  dataService$1.put(":collection", crud.put);
  dataService$1.patch(":collection", crud.patch);
  dataService$1.delete(":collection", crud.delete);

  var data$1 = dataService$1.parseRequest;

  const imgdata =
    "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Td4DLneAwSddMiRH8tMU8nng/Yy+KQsM3AKBNbe35j5OH4A0dbV8AxwcAqMFyl73eHd3e2//nmn29wOGi3Kv+RixSgAAEkxpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+Cjx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IlhNUCBDb3JlIDQuNC4wLUV4aXYyIj4KIDxyZGY6UkRGIHhtbG5zOnJkZj0iaHR0cDovL3d3dy53My5vcmcvMTk5OS8wMi8yMi1yZGYtc3ludGF4LW5zIyI+CiAgPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIKICAgIHhtbG5zOmlwdGNFeHQ9Imh0dHA6Ly9pcHRjLm9yZy9zdGQvSXB0YzR4bXBFeHQvMjAwOC0wMi0yOS8iCiAgICB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIKICAgIHhtbG5zOnN0RXZ0PSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvc1R5cGUvUmVzb3VyY2VFdmVudCMiCiAgICB4bWxuczpwbHVzPSJodHRwOi8vbnMudXNlcGx1cy5vcmcvbGRmL3htcC8xLjAvIgogICAgeG1sbnM6R0lNUD0iaHR0cDovL3d3dy5naW1wLm9yZy94bXAvIgogICAgeG1sbnM6ZGM9Imh0dHA6Ly9wdXJsLm9yZy9kYy9lbGVtZW50cy8xLjEvIgogICAgeG1sbnM6cGhvdG9zaG9wPSJodHRwOi8vbnMuYWRvYmUuY29tL3Bob3Rvc2hvcC8xLjAvIgogICAgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIgogICAgeG1sbnM6eG1wUmlnaHRzPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvcmlnaHRzLyIKICAgeG1wTU06RG9jdW1lbnRJRD0iZ2ltcDpkb2NpZDpnaW1wOjdjZDM3NWM3LTcwNmItNDlkMy1hOWRkLWNmM2Q3MmMwY2I4ZCIKICAgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDo2NGY2YTJlYy04ZjA5LTRkZTMtOTY3ZC05MTUyY2U5NjYxNTAiCiAgIHhtcE1NOk9yaWdpbmFsRG9jdW1lbnRJRD0ieG1wLmRpZDoxMmE1NzI5Mi1kNmJkLTRlYjQtOGUxNi1hODEzYjMwZjU0NWYiCiAgIEdJTVA6QVBJPSIyLjAiCiAgIEdJTVA6UGxhdGZvcm09IldpbmRvd3MiCiAgIEdJTVA6VGltZVN0YW1wPSIxNjEzMzAwNzI5NTMwNjQzIgogICBHSU1QOlZlcnNpb249IjIuMTAuMTIiCiAgIGRjOkZvcm1hdD0iaW1hZ2UvcG5nIgogICBwaG90b3Nob3A6Q3JlZGl0PSJHZXR0eSBJbWFnZXMvaVN0b2NrcGhvdG8iCiAgIHhtcDpDcmVhdG9yVG9vbD0iR0lNUCAyLjEwIgogICB4bXBSaWdodHM6V2ViU3RhdGVtZW50PSJodHRwczovL3d3dy5pc3RvY2twaG90by5jb20vbGVnYWwvbGljZW5zZS1hZ3JlZW1lbnQ/dXRtX21lZGl1bT1vcmdhbmljJmFtcDt1dG1fc291cmNlPWdvb2dsZSZhbXA7dXRtX2NhbXBhaWduPWlwdGN1cmwiPgogICA8aXB0Y0V4dDpMb2NhdGlvbkNyZWF0ZWQ+CiAgICA8cmRmOkJhZy8+CiAgIDwvaXB0Y0V4dDpMb2NhdGlvbkNyZWF0ZWQ+CiAgIDxpcHRjRXh0OkxvY2F0aW9uU2hvd24+CiAgICA8cmRmOkJhZy8+CiAgIDwvaXB0Y0V4dDpMb2NhdGlvblNob3duPgogICA8aXB0Y0V4dDpBcnR3b3JrT3JPYmplY3Q+CiAgICA8cmRmOkJhZy8+CiAgIDwvaXB0Y0V4dDpBcnR3b3JrT3JPYmplY3Q+CiAgIDxpcHRjRXh0OlJlZ2lzdHJ5SWQ+CiAgICA8cmRmOkJhZy8+CiAgIDwvaXB0Y0V4dDpSZWdpc3RyeUlkPgogICA8eG1wTU06SGlzdG9yeT4KICAgIDxyZGY6U2VxPgogICAgIDxyZGY6bGkKICAgICAgc3RFdnQ6YWN0aW9uPSJzYXZlZCIKICAgICAgc3RFdnQ6Y2hhbmdlZD0iLyIKICAgICAgc3RFdnQ6aW5zdGFuY2VJRD0ieG1wLmlpZDpjOTQ2M2MxMC05OWE4LTQ1NDQtYmRlOS1mNzY0ZjdhODJlZDkiCiAgICAgIHN0RXZ0OnNvZnR3YXJlQWdlbnQ9IkdpbXAgMi4xMCAoV2luZG93cykiCiAgICAgIHN0RXZ0OndoZW49IjIwMjEtMDItMTRUMTM6MDU6MjkiLz4KICAgIDwvcmRmOlNlcT4KICAgPC94bXBNTTpIaXN0b3J5PgogICA8cGx1czpJbWFnZVN1cHBsaWVyPgogICAgPHJkZjpTZXEvPgogICA8L3BsdXM6SW1hZ2VTdXBwbGllcj4KICAgPHBsdXM6SW1hZ2VDcmVhdG9yPgogICAgPHJkZjpTZXEvPgogICA8L3BsdXM6SW1hZ2VDcmVhdG9yPgogICA8cGx1czpDb3B5cmlnaHRPd25lcj4KICAgIDxyZGY6U2VxLz4KICAgPC9wbHVzOkNvcHlyaWdodE93bmVyPgogICA8cGx1czpMaWNlbnNvcj4KICAgIDxyZGY6U2VxPgogICAgIDxyZGY6bGkKICAgICAgcGx1czpMaWNlbnNvclVSTD0iaHR0cHM6Ly93d3cuaXN0b2NrcGhvdG8uY29tL3Bob3RvL2xpY2Vuc2UtZ20xMTUwMzQ1MzQxLT91dG1fbWVkaXVtPW9yZ2FuaWMmYW1wO3V0bV9zb3VyY2U9Z29vZ2xlJmFtcDt1dG1fY2FtcGFpZ249aXB0Y3VybCIvPgogICAgPC9yZGY6U2VxPgogICA8L3BsdXM6TGljZW5zb3I+CiAgIDxkYzpjcmVhdG9yPgogICAgPHJkZjpTZXE+CiAgICAgPHJkZjpsaT5WbGFkeXNsYXYgU2VyZWRhPC9yZGY6bGk+CiAgICA8L3JkZjpTZXE+CiAgIDwvZGM6Y3JlYXRvcj4KICAgPGRjOmRlc2NyaXB0aW9uPgogICAgPHJkZjpBbHQ+CiAgICAgPHJkZjpsaSB4bWw6bGFuZz0ieC1kZWZhdWx0Ij5TZXJ2aWNlIHRvb2xzIGljb24gb24gd2hpdGUgYmFja2dyb3VuZC4gVmVjdG9yIGlsbHVzdHJhdGlvbi48L3JkZjpsaT4KICAgIDwvcmRmOkFsdD4KICAgPC9kYzpkZXNjcmlwdGlvbj4KICA8L3JkZjpEZXNjcmlwdGlvbj4KIDwvcmRmOlJERj4KPC94OnhtcG1ldGE+CiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAKPD94cGFja2V0IGVuZD0idyI/PmWJCnkAAAAGYktHRAD/AP8A/6C9p5MAAAAJcEhZcwAALiMAAC4jAXilP3YAAAAHdElNRQflAg4LBR0CZnO/AAAARHRFWHRDb21tZW50AFNlcnZpY2UgdG9vbHMgaWNvbiBvbiB3aGl0ZSBiYWNrZ3JvdW5kLiBWZWN0b3IgaWxsdXN0cmF0aW9uLlwvEeIAAAMxSURBVHja7Z1bcuQwCEX7qrLQXlp2ynxNVWbK7dgWj3sl9JvYRhxACD369erW7UMzx/cYaychonAQvXM5ABYkpynoYIiEGdoQog6AYfywBrCxF4zNrX/7McBbuXJe8rXx/KBDULcGsMREzCbeZ4J6ME/9wVH5d95rogZp3npEgPLP3m2iUSGqXBJS5Dr6hmLm8kRuZABYti5TMaailV8LodNQwTTUWk4/WZk75l0kM0aZQdaZjMqkrQDAuyMVJWFjMB4GANXr0lbZBxQKr7IjI7QvVWkok/Jn5UHVh61CYPs+/i7eL9j3y/Au8WqoAIC34k8/9k7N8miLcaGWHwgjZXE/awyYX7h41wKMCskZM2HXAddDkTdglpSjz5bcKPbcCEKwT3+DhxtVpJvkEC7rZSgq32NMSBoXaCdiahDCKrND0fpX8oQlVsQ8IFQZ1VARdIF5wroekAjB07gsAgDUIbQHFENIDEX4CQANIVe8Iw/ASiACLXl28eaf579OPuBa9/mrELUYHQ1t3KHlZZnRcXb2/c7ygXIQZqjDMEzeSrOgCAhqYMvTUE+FKXoVxTxgk3DEPREjGzj3nAk/VaKyB9GVIu4oMyOlrQZgrBBEFG9PAZTfs3amYDGrP9Wl964IeFvtz9JFluIvlEvcdoXDOdxggbDxGwTXcxFRi/LdirKgZUBm7SUdJG69IwSUzAMWgOAq/4hyrZVaJISSNWHFVbEoCFEhyBrCtXS9L+so9oTy8wGqxbQDD350WTjNESVFEB5hdKzUGcV5QtYxVWR2Ssl4Mg9qI9u6FCBInJRXgfEEgtS9Cgrg7kKouq4mdcDNBnEHQvWFTdgdgsqP+MiluVeBM13ahx09AYSWi50gsF+I6vn7BmCEoHR3NBzkpIOw4+XdVBBGQUioblaZHbGlodtB+N/jxqwLX/x/NARfD8ADxTOCKIcwE4Lw0OIbguMYcGTlymEpHYLXIKx8zQEqIfS2lGJPaADFEBR/PMH79ErqtpnZmTBlvM4wgihPWDEEhXn1LISj50crNgfCp+dWHYQRCfb2zgfnBZmKGAyi914anK9Coi4LOMhoAn3uVtn+AGnLKxPUZnCuAAAAAElFTkSuQmCC";
  const img = Buffer.from(imgdata, "base64");

  var favicon = (method, tokens, query, body) => {
    console.log("serving favicon...");
    const headers = {
      "Content-Type": "image/png",
      "Content-Length": img.length,
    };
    let result = img;

    return {
      headers,
      result,
    };
  };

  var require$$0 =
    '<!DOCTYPE html>\r\n<html lang="en">\r\n<head>\r\n    <meta charset="UTF-8">\r\n    <meta http-equiv="X-UA-Compatible" content="IE=edge">\r\n    <meta name="viewport" content="width=device-width, initial-scale=1.0">\r\n    <title>SUPS Admin Panel</title>\r\n    <style>\r\n        * {\r\n            padding: 0;\r\n            margin: 0;\r\n        }\r\n\r\n        body {\r\n            padding: 32px;\r\n            font-size: 16px;\r\n        }\r\n\r\n        .layout::after {\r\n            content: \'\';\r\n            clear: both;\r\n            display: table;\r\n        }\r\n\r\n        .col {\r\n            display: block;\r\n            float: left;\r\n        }\r\n\r\n        p {\r\n            padding: 8px 16px;\r\n        }\r\n\r\n        table {\r\n            border-collapse: collapse;\r\n        }\r\n\r\n        caption {\r\n            font-size: 120%;\r\n            text-align: left;\r\n            padding: 4px 8px;\r\n            font-weight: bold;\r\n            background-color: #ddd;\r\n        }\r\n\r\n        table, tr, th, td {\r\n            border: 1px solid #ddd;\r\n        }\r\n\r\n        th, td {\r\n            padding: 4px 8px;\r\n        }\r\n\r\n        ul {\r\n            list-style: none;\r\n        }\r\n\r\n        .collection-list a {\r\n            display: block;\r\n            width: 120px;\r\n            padding: 4px 8px;\r\n            text-decoration: none;\r\n            color: black;\r\n            background-color: #ccc;\r\n        }\r\n        .collection-list a:hover {\r\n            background-color: #ddd;\r\n        }\r\n        .collection-list a:visited {\r\n            color: black;\r\n        }\r\n    </style>\r\n    <script type="module">\nimport { html, render } from \'https://unpkg.com/lit-html@1.3.0?module\';\nimport { until } from \'https://unpkg.com/lit-html@1.3.0/directives/until?module\';\n\nconst api = {\r\n    async get(url) {\r\n        return json(url);\r\n    },\r\n    async post(url, body) {\r\n        return json(url, {\r\n            method: \'POST\',\r\n            headers: { \'Content-Type\': \'application/json\' },\r\n            body: JSON.stringify(body)\r\n        });\r\n    }\r\n};\r\n\r\nasync function json(url, options) {\r\n    return await (await fetch(\'/\' + url, options)).json();\r\n}\r\n\r\nasync function getCollections() {\r\n    return api.get(\'data\');\r\n}\r\n\r\nasync function getRecords(collection) {\r\n    return api.get(\'data/\' + collection);\r\n}\r\n\r\nasync function getThrottling() {\r\n    return api.get(\'util/throttle\');\r\n}\r\n\r\nasync function setThrottling(throttle) {\r\n    return api.post(\'util\', { throttle });\r\n}\n\nasync function collectionList(onSelect) {\r\n    const collections = await getCollections();\r\n\r\n    return html`\r\n    <ul class="collection-list">\r\n        ${collections.map(collectionLi)}\r\n    </ul>`;\r\n\r\n    function collectionLi(name) {\r\n        return html`<li><a href="javascript:void(0)" @click=${(ev) => onSelect(ev, name)}>${name}</a></li>`;\r\n    }\r\n}\n\nasync function recordTable(collectionName) {\r\n    const records = await getRecords(collectionName);\r\n    const layout = getLayout(records);\r\n\r\n    return html`\r\n    <table>\r\n        <caption>${collectionName}</caption>\r\n        <thead>\r\n            <tr>${layout.map(f => html`<th>${f}</th>`)}</tr>\r\n        </thead>\r\n        <tbody>\r\n            ${records.map(r => recordRow(r, layout))}\r\n        </tbody>\r\n    </table>`;\r\n}\r\n\r\nfunction getLayout(records) {\r\n    const result = new Set([\'_id\']);\r\n    records.forEach(r => Object.keys(r).forEach(k => result.add(k)));\r\n\r\n    return [...result.keys()];\r\n}\r\n\r\nfunction recordRow(record, layout) {\r\n    return html`\r\n    <tr>\r\n        ${layout.map(f => html`<td>${JSON.stringify(record[f]) || html`<span>(missing)</span>`}</td>`)}\r\n    </tr>`;\r\n}\n\nasync function throttlePanel(display) {\r\n    const active = await getThrottling();\r\n\r\n    return html`\r\n    <p>\r\n        Request throttling: </span>${active}</span>\r\n        <button @click=${(ev) => set(ev, true)}>Enable</button>\r\n        <button @click=${(ev) => set(ev, false)}>Disable</button>\r\n    </p>`;\r\n\r\n    async function set(ev, state) {\r\n        ev.target.disabled = true;\r\n        await setThrottling(state);\r\n        display();\r\n    }\r\n}\n\n//import page from \'//unpkg.com/page/page.mjs\';\r\n\r\n\r\nfunction start() {\r\n    const main = document.querySelector(\'main\');\r\n    editor(main);\r\n}\r\n\r\nasync function editor(main) {\r\n    let list = html`<div class="col">Loading&hellip;</div>`;\r\n    let viewer = html`<div class="col">\r\n    <p>Select collection to view records</p>\r\n</div>`;\r\n    display();\r\n\r\n    list = html`<div class="col">${await collectionList(onSelect)}</div>`;\r\n    display();\r\n\r\n    async function display() {\r\n        render(html`\r\n        <section class="layout">\r\n            ${until(throttlePanel(display), html`<p>Loading</p>`)}\r\n        </section>\r\n        <section class="layout">\r\n            ${list}\r\n            ${viewer}\r\n        </section>`, main);\r\n    }\r\n\r\n    async function onSelect(ev, name) {\r\n        ev.preventDefault();\r\n        viewer = html`<div class="col">${await recordTable(name)}</div>`;\r\n        display();\r\n    }\r\n}\r\n\r\nstart();\n\n</script>\r\n</head>\r\n<body>\r\n    <main>\r\n        Loading&hellip;\r\n    </main>\r\n</body>\r\n</html>';

  const mode = process.argv[2] == "-dev" ? "dev" : "prod";

  const files = {
    index:
      mode == "prod"
        ? require$$0
        : fs__default["default"].readFileSync("./client/index.html", "utf-8"),
  };

  var admin = (method, tokens, query, body) => {
    const headers = {
      "Content-Type": "text/html",
    };
    let result = "";

    const resource = tokens.join("/");
    if (resource && resource.split(".").pop() == "js") {
      headers["Content-Type"] = "application/javascript";

      files[resource] =
        files[resource] ||
        fs__default["default"].readFileSync("./client/" + resource, "utf-8");
      result = files[resource];
    } else {
      result = files.index;
    }

    return {
      headers,
      result,
    };
  };

  /*
   * This service requires util plugin
   */

  const utilService = new Service_1();

  utilService.post("*", onRequest);
  utilService.get(":service", getStatus);

  function getStatus(context, tokens, query, body) {
    return context.util[context.params.service];
  }

  function onRequest(context, tokens, query, body) {
    Object.entries(body).forEach(([k, v]) => {
      console.log(`${k} ${v ? "enabled" : "disabled"}`);
      context.util[k] = v;
    });
    return "";
  }

  var util$1 = utilService.parseRequest;

  var services = {
    jsonstore,
    users,
    data: data$1,
    favicon,
    admin,
    util: util$1,
  };

  const { uuid: uuid$2 } = util;

  function initPlugin(settings) {
    const storage = createInstance(settings.seedData);
    const protectedStorage = createInstance(settings.protectedData);

    return function decoreateContext(context, request) {
      context.storage = storage;
      context.protectedStorage = protectedStorage;
    };
  }

  /**
   * Create storage instance and populate with seed data
   * @param {Object=} seedData Associative array with data. Each property is an object with properties in format {key: value}
   */
  function createInstance(seedData = {}) {
    const collections = new Map();

    // Initialize seed data from file
    for (let collectionName in seedData) {
      if (seedData.hasOwnProperty(collectionName)) {
        const collection = new Map();
        for (let recordId in seedData[collectionName]) {
          if (seedData.hasOwnProperty(collectionName)) {
            collection.set(recordId, seedData[collectionName][recordId]);
          }
        }
        collections.set(collectionName, collection);
      }
    }

    // Manipulation

    /**
     * Get entry by ID or list of all entries from collection or list of all collections
     * @param {string=} collection Name of collection to access. Throws error if not found. If omitted, returns list of all collections.
     * @param {number|string=} id ID of requested entry. Throws error if not found. If omitted, returns of list all entries in collection.
     * @return {Object} Matching entry.
     */
    function get(collection, id) {
      if (!collection) {
        return [...collections.keys()];
      }
      if (!collections.has(collection)) {
        throw new ReferenceError("Collection does not exist: " + collection);
      }
      const targetCollection = collections.get(collection);
      if (!id) {
        const entries = [...targetCollection.entries()];
        let result = entries.map(([k, v]) => {
          return Object.assign(deepCopy(v), { _id: k });
        });
        return result;
      }
      if (!targetCollection.has(id)) {
        throw new ReferenceError("Entry does not exist: " + id);
      }
      const entry = targetCollection.get(id);
      return Object.assign(deepCopy(entry), { _id: id });
    }

    /**
     * Add new entry to collection. ID will be auto-generated
     * @param {string} collection Name of collection to access. If the collection does not exist, it will be created.
     * @param {Object} data Value to store.
     * @return {Object} Original value with resulting ID under _id property.
     */
    function add(collection, data) {
      const record = assignClean({ _ownerId: data._ownerId }, data);

      let targetCollection = collections.get(collection);
      if (!targetCollection) {
        targetCollection = new Map();
        collections.set(collection, targetCollection);
      }
      let id = uuid$2();
      // Make sure new ID does not match existing value
      while (targetCollection.has(id)) {
        id = uuid$2();
      }

      record._createdOn = Date.now();
      targetCollection.set(id, record);
      return Object.assign(deepCopy(record), { _id: id });
    }

    /**
     * Replace entry by ID
     * @param {string} collection Name of collection to access. Throws error if not found.
     * @param {number|string} id ID of entry to update. Throws error if not found.
     * @param {Object} data Value to store. Record will be replaced!
     * @return {Object} Updated entry.
     */
    function set(collection, id, data) {
      if (!collections.has(collection)) {
        throw new ReferenceError("Collection does not exist: " + collection);
      }
      const targetCollection = collections.get(collection);
      if (!targetCollection.has(id)) {
        throw new ReferenceError("Entry does not exist: " + id);
      }

      const existing = targetCollection.get(id);
      const record = assignSystemProps(deepCopy(data), existing);
      record._updatedOn = Date.now();
      targetCollection.set(id, record);
      return Object.assign(deepCopy(record), { _id: id });
    }

    /**
     * Modify entry by ID
     * @param {string} collection Name of collection to access. Throws error if not found.
     * @param {number|string} id ID of entry to update. Throws error if not found.
     * @param {Object} data Value to store. Shallow merge will be performed!
     * @return {Object} Updated entry.
     */
    function merge(collection, id, data) {
      if (!collections.has(collection)) {
        throw new ReferenceError("Collection does not exist: " + collection);
      }
      const targetCollection = collections.get(collection);
      if (!targetCollection.has(id)) {
        throw new ReferenceError("Entry does not exist: " + id);
      }

      const existing = deepCopy(targetCollection.get(id));
      const record = assignClean(existing, data);
      record._updatedOn = Date.now();
      targetCollection.set(id, record);
      return Object.assign(deepCopy(record), { _id: id });
    }

    /**
     * Delete entry by ID
     * @param {string} collection Name of collection to access. Throws error if not found.
     * @param {number|string} id ID of entry to update. Throws error if not found.
     * @return {{_deletedOn: number}} Server time of deletion.
     */
    function del(collection, id) {
      if (!collections.has(collection)) {
        throw new ReferenceError("Collection does not exist: " + collection);
      }
      const targetCollection = collections.get(collection);
      if (!targetCollection.has(id)) {
        throw new ReferenceError("Entry does not exist: " + id);
      }
      targetCollection.delete(id);

      return { _deletedOn: Date.now() };
    }

    /**
     * Search in collection by query object
     * @param {string} collection Name of collection to access. Throws error if not found.
     * @param {Object} query Query object. Format {prop: value}.
     * @return {Object[]} Array of matching entries.
     */
    function query(collection, query) {
      if (!collections.has(collection)) {
        throw new ReferenceError("Collection does not exist: " + collection);
      }
      const targetCollection = collections.get(collection);
      const result = [];
      // Iterate entries of target collection and compare each property with the given query
      for (let [key, entry] of [...targetCollection.entries()]) {
        let match = true;
        for (let prop in entry) {
          if (query.hasOwnProperty(prop)) {
            const targetValue = query[prop];
            // Perform lowercase search, if value is string
            if (
              typeof targetValue === "string" &&
              typeof entry[prop] === "string"
            ) {
              if (
                targetValue.toLocaleLowerCase() !==
                entry[prop].toLocaleLowerCase()
              ) {
                match = false;
                break;
              }
            } else if (targetValue != entry[prop]) {
              match = false;
              break;
            }
          }
        }

        if (match) {
          result.push(Object.assign(deepCopy(entry), { _id: key }));
        }
      }

      return result;
    }

    return { get, add, set, merge, delete: del, query };
  }

  function assignSystemProps(target, entry, ...rest) {
    const whitelist = ["_id", "_createdOn", "_updatedOn", "_ownerId"];
    for (let prop of whitelist) {
      if (entry.hasOwnProperty(prop)) {
        target[prop] = deepCopy(entry[prop]);
      }
    }
    if (rest.length > 0) {
      Object.assign(target, ...rest);
    }

    return target;
  }

  function assignClean(target, entry, ...rest) {
    const blacklist = ["_id", "_createdOn", "_updatedOn", "_ownerId"];
    for (let key in entry) {
      if (blacklist.includes(key) == false) {
        target[key] = deepCopy(entry[key]);
      }
    }
    if (rest.length > 0) {
      Object.assign(target, ...rest);
    }

    return target;
  }

  function deepCopy(value) {
    if (Array.isArray(value)) {
      return value.map(deepCopy);
    } else if (typeof value == "object") {
      return [...Object.entries(value)].reduce(
        (p, [k, v]) => Object.assign(p, { [k]: deepCopy(v) }),
        {}
      );
    } else {
      return value;
    }
  }

  var storage = initPlugin;

  const {
    ConflictError: ConflictError$1,
    CredentialError: CredentialError$1,
    RequestError: RequestError$2,
  } = errors;

  function initPlugin$1(settings) {
    const identity = settings.identity;

    return function decorateContext(context, request) {
      context.auth = {
        register,
        login,
        logout,
      };

      const userToken = request.headers["x-authorization"];
      if (userToken !== undefined) {
        let user;
        const session = findSessionByToken(userToken);
        if (session !== undefined) {
          const userData = context.protectedStorage.get(
            "users",
            session.userId
          );
          if (userData !== undefined) {
            console.log("Authorized as " + userData[identity]);
            user = userData;
          }
        }
        if (user !== undefined) {
          context.user = user;
        } else {
          throw new CredentialError$1("Invalid access token");
        }
      }

      function register(body) {
        if (
          body.hasOwnProperty(identity) === false ||
          body.hasOwnProperty("password") === false ||
          body[identity].length == 0 ||
          body.password.length == 0
        ) {
          throw new RequestError$2("Missing fields");
        } else if (
          context.protectedStorage.query("users", {
            [identity]: body[identity],
          }).length !== 0
        ) {
          throw new ConflictError$1(
            `A user with the same ${identity} already exists`
          );
        } else {
          const newUser = Object.assign({}, body, {
            [identity]: body[identity],
            hashedPassword: hash(body.password),
          });
          const result = context.protectedStorage.add("users", newUser);
          delete result.hashedPassword;

          const session = saveSession(result._id);
          result.accessToken = session.accessToken;

          return result;
        }
      }

      function login(body) {
        const targetUser = context.protectedStorage.query("users", {
          [identity]: body[identity],
        });
        if (targetUser.length == 1) {
          if (hash(body.password) === targetUser[0].hashedPassword) {
            const result = targetUser[0];
            delete result.hashedPassword;

            const session = saveSession(result._id);
            result.accessToken = session.accessToken;

            return result;
          } else {
            throw new CredentialError$1("Login or password don't match");
          }
        } else {
          throw new CredentialError$1("Login or password don't match");
        }
      }

      function logout() {
        if (context.user !== undefined) {
          const session = findSessionByUserId(context.user._id);
          if (session !== undefined) {
            context.protectedStorage.delete("sessions", session._id);
          }
        } else {
          throw new CredentialError$1("User session does not exist");
        }
      }

      function saveSession(userId) {
        let session = context.protectedStorage.add("sessions", { userId });
        const accessToken = hash(session._id);
        session = context.protectedStorage.set(
          "sessions",
          session._id,
          Object.assign({ accessToken }, session)
        );
        return session;
      }

      function findSessionByToken(userToken) {
        return context.protectedStorage.query("sessions", {
          accessToken: userToken,
        })[0];
      }

      function findSessionByUserId(userId) {
        return context.protectedStorage.query("sessions", { userId })[0];
      }
    };
  }

  const secret = "This is not a production server";

  function hash(string) {
    const hash = crypto__default["default"].createHmac("sha256", secret);
    hash.update(string);
    return hash.digest("hex");
  }

  var auth = initPlugin$1;

  function initPlugin$2(settings) {
    const util = {
      throttle: false,
    };

    return function decoreateContext(context, request) {
      context.util = util;
    };
  }

  var util$2 = initPlugin$2;

  /*
   * This plugin requires auth and storage plugins
   */

  const {
    RequestError: RequestError$3,
    ConflictError: ConflictError$2,
    CredentialError: CredentialError$2,
    AuthorizationError: AuthorizationError$2,
  } = errors;

  function initPlugin$3(settings) {
    const actions = {
      GET: ".read",
      POST: ".create",
      PUT: ".update",
      PATCH: ".update",
      DELETE: ".delete",
    };
    const rules = Object.assign(
      {
        "*": {
          ".create": ["User"],
          ".update": ["Owner"],
          ".delete": ["Owner"],
        },
      },
      settings.rules
    );

    return function decorateContext(context, request) {
      // special rules (evaluated at run-time)
      const get = (collectionName, id) => {
        return context.storage.get(collectionName, id);
      };
      const isOwner = (user, object) => {
        return user._id == object._ownerId;
      };
      context.rules = {
        get,
        isOwner,
      };
      const isAdmin = request.headers.hasOwnProperty("x-admin");

      context.canAccess = canAccess;

      function canAccess(data, newData) {
        const user = context.user;
        const action = actions[request.method];
        let { rule, propRules } = getRule(
          action,
          context.params.collection,
          data
        );

        if (Array.isArray(rule)) {
          rule = checkRoles(rule, data);
        } else if (typeof rule == "string") {
          rule = !!eval(rule);
        }
        if (!rule && !isAdmin) {
          throw new CredentialError$2();
        }
        propRules.map((r) => applyPropRule(action, r, user, data, newData));
      }

      function applyPropRule(action, [prop, rule], user, data, newData) {
        // NOTE: user needs to be in scope for eval to work on certain rules
        if (typeof rule == "string") {
          rule = !!eval(rule);
        }

        if (rule == false) {
          if (action == ".create" || action == ".update") {
            delete newData[prop];
          } else if (action == ".read") {
            delete data[prop];
          }
        }
      }

      function checkRoles(roles, data, newData) {
        if (roles.includes("Guest")) {
          return true;
        } else if (!context.user && !isAdmin) {
          throw new AuthorizationError$2();
        } else if (roles.includes("User")) {
          return true;
        } else if (context.user && roles.includes("Owner")) {
          return context.user._id == data._ownerId;
        } else {
          return false;
        }
      }
    };

    function getRule(action, collection, data = {}) {
      let currentRule = ruleOrDefault(true, rules["*"][action]);
      let propRules = [];

      // Top-level rules for the collection
      const collectionRules = rules[collection];
      if (collectionRules !== undefined) {
        // Top-level rule for the specific action for the collection
        currentRule = ruleOrDefault(currentRule, collectionRules[action]);

        // Prop rules
        const allPropRules = collectionRules["*"];
        if (allPropRules !== undefined) {
          propRules = ruleOrDefault(
            propRules,
            getPropRule(allPropRules, action)
          );
        }

        // Rules by record id
        const recordRules = collectionRules[data._id];
        if (recordRules !== undefined) {
          currentRule = ruleOrDefault(currentRule, recordRules[action]);
          propRules = ruleOrDefault(
            propRules,
            getPropRule(recordRules, action)
          );
        }
      }

      return {
        rule: currentRule,
        propRules,
      };
    }

    function ruleOrDefault(current, rule) {
      return rule === undefined || rule.length === 0 ? current : rule;
    }

    function getPropRule(record, action) {
      const props = Object.entries(record)
        .filter(([k]) => k[0] != ".")
        .filter(([k, v]) => v.hasOwnProperty(action))
        .map(([k, v]) => [k, v[action]]);

      return props;
    }
  }

  var rules = initPlugin$3;

  var identity = "email";
  var protectedData = {
    users: {
      "35c62d76-8152-4626-8712-eeb96381bea8": {
        email: "peter@abv.bg",
        username: "Peter",
        hashedPassword:
          "83313014ed3e2391aa1332615d2f053cf5c1bfe05ca1cbcb5582443822df6eb1",
      },
      "847ec027-f659-4086-8032-5173e2f9c93a": {
        email: "george@abv.bg",
        username: "George",
        hashedPassword:
          "83313014ed3e2391aa1332615d2f053cf5c1bfe05ca1cbcb5582443822df6eb1",
      },
      "60f0cf0b-34b0-4abd-9769-8c42f830dffc": {
        email: "admin@abv.bg",
        username: "Admin",
        hashedPassword:
          "fac7060c3e17e6f151f247eacb2cd5ae80b8c36aedb8764e18a41bbdc16aa302",
      },
    },
    sessions: {},
  };
  var seedData = {
    games: {
      "c6c6b213-e3d9-40e0-9323-9d7a56252fe3": {
        _ownerId: "0ee95c63-7e58-4b18-a6ba-76729967cc94",
        title: "World of Warcraft",
        category: "Strategy",
        maxLevel: "100",
        imageUrl:
          "data:image/jpeg;base64,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",
        summary:
          "Set in the fictional world of Azeroth, WoW allows players to create avatar-style characters and explore a sprawling universe while interacting with nonreal players—called nonplayer characters (NPCs)—and other real-world players (PCs)",
        _createdOn: 1722277094300,
        _id: "c6c6b213-e3d9-40e0-9323-9d7a56252fe3",
      },
      "e39b6c6d-9b8d-449e-b298-b7e9ad4a53a7": {
        _ownerId: "6809c5ae-2f57-42c5-8ba4-659c509f866e",
        title: "Gran Turismo 7",
        category: "Rally",
        maxLevel: "1000",
        imageUrl:
          "data:image/jpeg;base64,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",
        summary:
          "Gran Turismo 7 features the return of the single player campaign, GT Simulation Mode. Other returning features are the return of traditional racing tracks and vehicles, Special Events, Championships, Driving School, Tuning Parts Shop, Used Cars dealership, and GT Auto while still retaining the new GT Sport Mode, Brand Central, and Discover (now labelled Showcase) that were introduced in Gran Turismo Sport",
        _createdOn: 1722279193076,
        _id: "e39b6c6d-9b8d-449e-b298-b7e9ad4a53a7",
      },
    },
    recipes: {
      "3987279d-0ad4-4afb-8ca9-5b256ae3b298": {
        _ownerId: "35c62d76-8152-4626-8712-eeb96381bea8",
        name: "Easy Lasagna",
        img: "assets/lasagna.jpg",
        ingredients: [
          "1 tbsp Ingredient 1",
          "2 cups Ingredient 2",
          "500 g  Ingredient 3",
          "25 g Ingredient 4",
        ],
        steps: ["Prepare ingredients", "Mix ingredients", "Cook until done"],
        _createdOn: 1613551279012,
      },
      "8f414b4f-ab39-4d36-bedb-2ad69da9c830": {
        _ownerId: "35c62d76-8152-4626-8712-eeb96381bea8",
        name: "Grilled Duck Fillet",
        img: "assets/roast.jpg",
        ingredients: [
          "500 g  Ingredient 1",
          "3 tbsp Ingredient 2",
          "2 cups Ingredient 3",
        ],
        steps: ["Prepare ingredients", "Mix ingredients", "Cook until done"],
        _createdOn: 1613551344360,
      },
      "985d9eab-ad2e-4622-a5c8-116261fb1fd2": {
        _ownerId: "847ec027-f659-4086-8032-5173e2f9c93a",
        name: "Roast Trout",
        img: "assets/fish.jpg",
        ingredients: [
          "4 cups Ingredient 1",
          "1 tbsp Ingredient 2",
          "1 tbsp Ingredient 3",
          "750 g  Ingredient 4",
          "25 g Ingredient 5",
        ],
        steps: ["Prepare ingredients", "Mix ingredients", "Cook until done"],
        _createdOn: 1613551388703,
      },
    },
    comments: {
      "0a272c58-b7ea-4e09-a000-7ec988248f66": {
        _ownerId: "35c62d76-8152-4626-8712-eeb96381bea8",
        content: "Great recipe!",
        recipeId: "8f414b4f-ab39-4d36-bedb-2ad69da9c830",
        _createdOn: 1614260681375,
        _id: "0a272c58-b7ea-4e09-a000-7ec988248f66",
      },
    },
    records: {
      i01: {
        name: "John1",
        val: 1,
        _createdOn: 1613551388703,
      },
      i02: {
        name: "John2",
        val: 1,
        _createdOn: 1613551388713,
      },
      i03: {
        name: "John3",
        val: 2,
        _createdOn: 1613551388723,
      },
      i04: {
        name: "John4",
        val: 2,
        _createdOn: 1613551388733,
      },
      i05: {
        name: "John5",
        val: 2,
        _createdOn: 1613551388743,
      },
      i06: {
        name: "John6",
        val: 3,
        _createdOn: 1613551388753,
      },
      i07: {
        name: "John7",
        val: 3,
        _createdOn: 1613551388763,
      },
      i08: {
        name: "John8",
        val: 2,
        _createdOn: 1613551388773,
      },
      i09: {
        name: "John9",
        val: 3,
        _createdOn: 1613551388783,
      },
      i10: {
        name: "John10",
        val: 1,
        _createdOn: 1613551388793,
      },
    },
    catches: {
      "07f260f4-466c-4607-9a33-f7273b24f1b4": {
        _ownerId: "35c62d76-8152-4626-8712-eeb96381bea8",
        angler: "Paulo Admorim",
        weight: 636,
        species: "Atlantic Blue Marlin",
        location: "Vitoria, Brazil",
        bait: "trolled pink",
        captureTime: 80,
        _createdOn: 1614760714812,
        _id: "07f260f4-466c-4607-9a33-f7273b24f1b4",
      },
      "bdabf5e9-23be-40a1-9f14-9117b6702a9d": {
        _ownerId: "847ec027-f659-4086-8032-5173e2f9c93a",
        angler: "John Does",
        weight: 554,
        species: "Atlantic Blue Marlin",
        location: "Buenos Aires, Argentina",
        bait: "trolled pink",
        captureTime: 120,
        _createdOn: 1614760782277,
        _id: "bdabf5e9-23be-40a1-9f14-9117b6702a9d",
      },
    },
    furniture: {},
    orders: {},
    movies: {
      "1240549d-f0e0-497e-ab99-eb8f703713d7": {
        _ownerId: "847ec027-f659-4086-8032-5173e2f9c93a",
        title: "Black Widow",
        description:
          "Natasha Romanoff aka Black Widow confronts the darker parts of her ledger when a dangerous conspiracy with ties to her past arises. Comes on the screens 2020.",
        img: "https://miro.medium.com/max/735/1*akkAa2CcbKqHsvqVusF3-w.jpeg",
        _createdOn: 1614935055353,
        _id: "1240549d-f0e0-497e-ab99-eb8f703713d7",
      },
      "143e5265-333e-4150-80e4-16b61de31aa0": {
        _ownerId: "847ec027-f659-4086-8032-5173e2f9c93a",
        title: "Wonder Woman 1984",
        description:
          "Diana must contend with a work colleague and businessman, whose desire for extreme wealth sends the world down a path of destruction, after an ancient artifact that grants wishes goes missing.",
        img: "https://pbs.twimg.com/media/ETINgKwWAAAyA4r.jpg",
        _createdOn: 1614935181470,
        _id: "143e5265-333e-4150-80e4-16b61de31aa0",
      },
      "a9bae6d8-793e-46c4-a9db-deb9e3484909": {
        _ownerId: "35c62d76-8152-4626-8712-eeb96381bea8",
        title: "Top Gun 2",
        description:
          "After more than thirty years of service as one of the Navy's top aviators, Pete Mitchell is where he belongs, pushing the envelope as a courageous test pilot and dodging the advancement in rank that would ground him.",
        img: "https://i.pinimg.com/originals/f2/a4/58/f2a458048757bc6914d559c9e4dc962a.jpg",
        _createdOn: 1614935268135,
        _id: "a9bae6d8-793e-46c4-a9db-deb9e3484909",
      },
    },
    likes: {},
    ideas: {
      "833e0e57-71dc-42c0-b387-0ce0caf5225e": {
        _ownerId: "847ec027-f659-4086-8032-5173e2f9c93a",
        title: "Best Pilates Workout To Do At Home",
        description:
          "Lorem ipsum dolor, sit amet consectetur adipisicing elit. Minima possimus eveniet ullam aspernatur corporis tempore quia nesciunt nostrum mollitia consequatur. At ducimus amet aliquid magnam nulla sed totam blanditiis ullam atque facilis corrupti quidem nisi iusto saepe, consectetur culpa possimus quos? Repellendus, dicta pariatur! Delectus, placeat debitis error dignissimos nesciunt magni possimus quo nulla, fuga corporis maxime minus nihil doloremque aliquam quia recusandae harum. Molestias dolorum recusandae commodi velit cum sapiente placeat alias rerum illum repudiandae? Suscipit tempore dolore autem, neque debitis quisquam molestias officia hic nesciunt? Obcaecati optio fugit blanditiis, explicabo odio at dicta asperiores distinctio expedita dolor est aperiam earum! Molestias sequi aliquid molestiae, voluptatum doloremque saepe dignissimos quidem quas harum quo. Eum nemo voluptatem hic corrupti officiis eaque et temporibus error totam numquam sequi nostrum assumenda eius voluptatibus quia sed vel, rerum, excepturi maxime? Pariatur, provident hic? Soluta corrupti aspernatur exercitationem vitae accusantium ut ullam dolor quod!",
        img: "./images/best-pilates-youtube-workouts-2__medium_4x3.jpg",
        _createdOn: 1615033373504,
        _id: "833e0e57-71dc-42c0-b387-0ce0caf5225e",
      },
      "247efaa7-8a3e-48a7-813f-b5bfdad0f46c": {
        _ownerId: "847ec027-f659-4086-8032-5173e2f9c93a",
        title: "4 Eady DIY Idea To Try!",
        description:
          "Similique rem culpa nemo hic recusandae perspiciatis quidem, quia expedita, sapiente est itaque optio enim placeat voluptates sit, fugit dignissimos tenetur temporibus exercitationem in quis magni sunt vel. Corporis officiis ut sapiente exercitationem consectetur debitis suscipit laborum quo enim iusto, labore, quod quam libero aliquid accusantium! Voluptatum quos porro fugit soluta tempore praesentium ratione dolorum impedit sunt dolores quod labore laudantium beatae architecto perspiciatis natus cupiditate, iure quia aliquid, iusto modi esse!",
        img: "./images/brightideacropped.jpg",
        _createdOn: 1615033452480,
        _id: "247efaa7-8a3e-48a7-813f-b5bfdad0f46c",
      },
      "b8608c22-dd57-4b24-948e-b358f536b958": {
        _ownerId: "35c62d76-8152-4626-8712-eeb96381bea8",
        title: "Dinner Recipe",
        description:
          "Consectetur labore et corporis nihil, officiis tempora, hic ex commodi sit aspernatur ad minima? Voluptas nesciunt, blanditiis ex nulla incidunt facere tempora laborum ut aliquid beatae obcaecati quidem reprehenderit consequatur quis iure natus quia totam vel. Amet explicabo quidem repellat unde tempore et totam minima mollitia, adipisci vel autem, enim voluptatem quasi exercitationem dolor cum repudiandae dolores nostrum sit ullam atque dicta, tempora iusto eaque! Rerum debitis voluptate impedit corrupti quibusdam consequatur minima, earum asperiores soluta. A provident reiciendis voluptates et numquam totam eveniet! Dolorum corporis libero dicta laborum illum accusamus ullam?",
        img: "./images/dinner.jpg",
        _createdOn: 1615033491967,
        _id: "b8608c22-dd57-4b24-948e-b358f536b958",
      },
    },
    catalog: {
      "53d4dbf5-7f41-47ba-b485-43eccb91cb95": {
        _ownerId: "35c62d76-8152-4626-8712-eeb96381bea8",
        make: "Table",
        model: "Swedish",
        year: 2015,
        description: "Medium table",
        price: 235,
        img: "./images/table.png",
        material: "Hardwood",
        _createdOn: 1615545143015,
        _id: "53d4dbf5-7f41-47ba-b485-43eccb91cb95",
      },
      "f5929b5c-bca4-4026-8e6e-c09e73908f77": {
        _ownerId: "847ec027-f659-4086-8032-5173e2f9c93a",
        make: "Sofa",
        model: "ES-549-M",
        year: 2018,
        description: "Three-person sofa, blue",
        price: 1200,
        img: "./images/sofa.jpg",
        material: "Frame - steel, plastic; Upholstery - fabric",
        _createdOn: 1615545572296,
        _id: "f5929b5c-bca4-4026-8e6e-c09e73908f77",
      },
      "c7f51805-242b-45ed-ae3e-80b68605141b": {
        _ownerId: "847ec027-f659-4086-8032-5173e2f9c93a",
        make: "Chair",
        model: "Bright Dining Collection",
        year: 2017,
        description: "Dining chair",
        price: 180,
        img: "./images/chair.jpg",
        material: "Wood laminate; leather",
        _createdOn: 1615546332126,
        _id: "c7f51805-242b-45ed-ae3e-80b68605141b",
      },
    },
    teams: {
      "34a1cab1-81f1-47e5-aec3-ab6c9810efe1": {
        _ownerId: "35c62d76-8152-4626-8712-eeb96381bea8",
        name: "Storm Troopers",
        logoUrl: "/assets/atat.png",
        description: "These ARE the droids we're looking for",
        _createdOn: 1615737591748,
        _id: "34a1cab1-81f1-47e5-aec3-ab6c9810efe1",
      },
      "dc888b1a-400f-47f3-9619-07607966feb8": {
        _ownerId: "847ec027-f659-4086-8032-5173e2f9c93a",
        name: "Team Rocket",
        logoUrl: "/assets/rocket.png",
        description: "Gotta catch 'em all!",
        _createdOn: 1615737655083,
        _id: "dc888b1a-400f-47f3-9619-07607966feb8",
      },
      "733fa9a1-26b6-490d-b299-21f120b2f53a": {
        _ownerId: "847ec027-f659-4086-8032-5173e2f9c93a",
        name: "Minions",
        logoUrl: "/assets/hydrant.png",
        description:
          "Friendly neighbourhood jelly beans, helping evil-doers succeed.",
        _createdOn: 1615737688036,
        _id: "733fa9a1-26b6-490d-b299-21f120b2f53a",
      },
    },
    members: {
      "cc9b0a0f-655d-45d7-9857-0a61c6bb2c4d": {
        _ownerId: "35c62d76-8152-4626-8712-eeb96381bea8",
        teamId: "34a1cab1-81f1-47e5-aec3-ab6c9810efe1",
        status: "member",
        _createdOn: 1616236790262,
        _updatedOn: 1616236792930,
      },
      "61a19986-3b86-4347-8ca4-8c074ed87591": {
        _ownerId: "847ec027-f659-4086-8032-5173e2f9c93a",
        teamId: "dc888b1a-400f-47f3-9619-07607966feb8",
        status: "member",
        _createdOn: 1616237188183,
        _updatedOn: 1616237189016,
      },
      "8a03aa56-7a82-4a6b-9821-91349fbc552f": {
        _ownerId: "847ec027-f659-4086-8032-5173e2f9c93a",
        teamId: "733fa9a1-26b6-490d-b299-21f120b2f53a",
        status: "member",
        _createdOn: 1616237193355,
        _updatedOn: 1616237195145,
      },
      "9be3ac7d-2c6e-4d74-b187-04105ab7e3d6": {
        _ownerId: "35c62d76-8152-4626-8712-eeb96381bea8",
        teamId: "dc888b1a-400f-47f3-9619-07607966feb8",
        status: "member",
        _createdOn: 1616237231299,
        _updatedOn: 1616237235713,
      },
      "280b4a1a-d0f3-4639-aa54-6d9158365152": {
        _ownerId: "60f0cf0b-34b0-4abd-9769-8c42f830dffc",
        teamId: "dc888b1a-400f-47f3-9619-07607966feb8",
        status: "member",
        _createdOn: 1616237257265,
        _updatedOn: 1616237278248,
      },
      "e797fa57-bf0a-4749-8028-72dba715e5f8": {
        _ownerId: "60f0cf0b-34b0-4abd-9769-8c42f830dffc",
        teamId: "34a1cab1-81f1-47e5-aec3-ab6c9810efe1",
        status: "member",
        _createdOn: 1616237272948,
        _updatedOn: 1616237293676,
      },
    },
  };
  var rules$1 = {
    users: {
      ".create": false,
      ".read": ["Owner"],
      ".update": false,
      ".delete": false,
    },
    members: {
      ".update": "isOwner(user, get('teams', data.teamId))",
      ".delete":
        "isOwner(user, get('teams', data.teamId)) || isOwner(user, data)",
      "*": {
        teamId: {
          ".update": "newData.teamId = data.teamId",
        },
        status: {
          ".create": "newData.status = 'pending'",
        },
      },
    },
  };
  var settings = {
    identity: identity,
    protectedData: protectedData,
    seedData: seedData,
    rules: rules$1,
  };

  const plugins = [
    storage(settings),
    auth(settings),
    util$2(),
    rules(settings),
  ];

  const server = http__default["default"].createServer(
    requestHandler(plugins, services)
  );

  const port = 3030;
  server.listen(port);
  console.log(
    `Server started on port ${port}. You can make requests to http://localhost:${port}/`
  );
  console.log(`Admin panel located at http://localhost:${port}/admin`);

  var softuniPracticeServer = {};

  return softuniPracticeServer;
});
