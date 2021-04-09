// https://dev.to/ycmjason/recreating-vue-3-reactivity-api-roughly-1o6a

const { result } = require("lodash");

const ReactivityErrors = Object.freeze({
  RecursiveWatch: 'Recursive updates detected. This is likely caused by a watcher that mutates its own depencies.',
});

const nextTick = () => new Promise((resolve) => {
  setTimeout(resolve, 0);
});

const currentDependencies = new Set();

const registeredWatchers = [];

const RECURSION_LIMIT = 100;

setInterval(() => {
  registeredWatchers.forEach((w) => { w.callCount = 0; });
}, 0);

const watch = (fn, { async = true } = {}) => {
  const watcher = {
    callCount: 0,
    dependencies: new Set(),
  };
  const callback = () => {
    watcher.callCount += 1;
    if (watcher.callCount > RECURSION_LIMIT) {
      throw new Error(ReactivityErrors.RecursiveWatch);
    }
    currentDependencies.clear();
    fn();
    watcher.dependencies = new Set(currentDependencies);
  }
  watcher.callback = async
    ? () => { nextTick().then(callback); }
    : callback;
  callback();
  registeredWatchers.push(watcher);
};

const reactiveProxyHandler = (symbolsForProperties) => {
  const getSymbol = (property) => {
    if (!symbolsForProperties.has(property)) {
      symbolsForProperties.set(property, Symbol(property));
    }
    return symbolsForProperties.get(property);
  };

  return {
    get(target, property, receiver) {
      const symbol = getSymbol(property);
      currentDependencies.add(symbol);
      const value = Reflect.get(target, property, receiver);
      if (value && typeof value === 'object') {
        return new Proxy(value, reactiveProxyHandler(symbolsForProperties));
      }
      return value;
    },
    set(target, property, value, receiver) {
      const symbol = getSymbol(property);
      const result = Reflect.set(target, property, value, receiver);
      registeredWatchers
        .filter(({ dependencies }) => dependencies.has(symbol))
        .forEach(({ callback }) => callback());
      return result;
    },
    deleteProperty(target, property) {
      const symbol = getSymbol(property);
      const result = Reflect.deleteProperty(target, property);
      registeredWatchers
        .filter(({ dependencies }) => dependencies.has(symbol))
        .forEach(({ callback }) => callback());
      return result;
    },
  };
};

const reactive = (value) => {
  const symbolsForProperties = new Map();
  return new Proxy(value, reactiveProxyHandler(symbolsForProperties));
};

const ref = (value) => reactive({ value });

const computed = (fn) => {
  const value = ref(undefined);
  watch(() => {
    value.value = fn();
  }, { async: false });
  return value;
};

module.exports = {
  reactive,
  ref,
  watch,
  nextTick,
  computed,
  ReactivityErrors,
};
