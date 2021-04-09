// https://dev.to/ycmjason/recreating-vue-3-reactivity-api-roughly-1o6a

const ReactivityErrors = Object.freeze({
  RecursiveWatch: 'Don\'t call watch() recursively.',
  ComputedAssignment: 'Don\'t assign a reactive value inside of a computed() function.',
});

const debounce = (func, wait = 0) => {
  let timeout = null;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

const nextTick = () => new Promise((resolve) => {
  setTimeout(resolve, 0);
});

const effects = new Set();

const watchers = [];

const RECURSION_LIMIT = 100;

setInterval(() => {
  watchers.forEach((w) => { w.callCount = 0; });
}, 0);

const watch = (fn, { async = true } = {}) => {
  const watcher = {
    callCount: 0,
    dependencies: new Set(),
    callback: () => {
      watcher.callCount += 1;
      if (watcher.callCount > RECURSION_LIMIT) {
        throw new Error(ReactivityErrors.RecursiveWatch);
      }
      effects.clear();
      fn();
      watcher.dependencies = new Set(effects);
    },
  };
  const callback = () => {
    watcher.callCount += 1;
    if (watcher.callCount > RECURSION_LIMIT) {
      throw new Error(ReactivityErrors.RecursiveWatch);
    }
    effects.clear();
    fn();
    watcher.dependencies = new Set(effects);
  }
  watcher.callback = async ? debounce(callback) : callback;
  callback();
  watchers.push(watcher);
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
      effects.add(symbol);
      const value = Reflect.get(target, property, receiver);
      if (value && typeof value === 'object') {
        return new Proxy(value, reactiveProxyHandler(symbolsForProperties));
      }
      return value;
    },
    set(target, property, value, receiver) {
      const symbol = getSymbol(property);
      const result = Reflect.set(target, property, value, receiver);
      watchers
        .filter(({ dependencies }) => dependencies.has(symbol))
        .forEach(({ callback }) => callback());
      return result;
    },
  };
  // TODO: implement delete
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
  debounce,
  nextTick,
  computed,
  ReactivityErrors,
};
