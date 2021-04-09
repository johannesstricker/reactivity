const { it, expect } = require('@jest/globals');
const {
  reactive,
  ref,
  watch,
  nextTick,
  computed,
  ReactivityErrors,
} = require('./reactivity');

const createMock = (func = () => {}) => {
  const mock = () => {
    mock.callCount += 1;
    return func();
  };
  mock.callCount = 0;
  return mock;
};

describe('watch', () => {
  it('runs the watch function immediately once', async () => {
    const mock = createMock();
    watch(mock);
    expect(mock.callCount).toBe(1);
    await nextTick();
    expect(mock.callCount).toBe(1);
  });

  it('runs synchronously when called with async: false', () => {
    const reactiveObject = reactive({ foo: 1 });
    const mock = createMock(() => reactiveObject.foo);
    watch(mock, { async: false });
    expect(mock.callCount).toBe(1);
    reactiveObject.foo = 2;
    expect(mock.callCount).toBe(2);
  });

  it('raises an error when the watcher calls itself recursively', () => {
    const reactiveObject = reactive({ foo: 1 });
    const mock = createMock(() => {
      if (reactiveObject.foo > 0) {
        reactiveObject.foo += 1;
      }
    });
    // it doesn't raise on the first invocation, because
    // the dependencies are not yet known
    watch(mock, { async: false });
    expect(mock.callCount).toBe(1);
    expect(() => { reactiveObject.foo += 1; }).toThrow(ReactivityErrors.RecursiveWatch);
  });

  it('runs once and then reruns the function debounced whenever any of the dependencies change', async () => {
    const reactiveObject = reactive({ foo: 'bar' });
    const reactiveValue = ref(5);

    const mock = createMock(() => {
      if (reactiveObject.foo === undefined) { return false; }
      if (reactiveValue.value === undefined) { return false; }
      return true;
    });
    watch(mock);
    expect(mock.callCount).toBe(1);
    reactiveObject.foo = 'bazz';
    expect(mock.callCount).toBe(1);
    await nextTick();
    expect(mock.callCount).toBe(2);
    reactiveValue.value = 6;
    expect(mock.callCount).toBe(2);
    await nextTick();
    expect(mock.callCount).toBe(3);
  });

  it('is not invoked when changing sibling properties', async () => {
    const reactiveObject = reactive({
      foo: {
        one: '1',
        two: '2',
      },
    });
    const mock = createMock(() => reactiveObject.foo.one);
    watch(mock);
    expect(mock.callCount).toBe(1);
    reactiveObject.foo.two = '3';
    await nextTick();
    expect(mock.callCount).toBe(1);
    reactiveObject.foo.one = '2';
    await nextTick();
    expect(mock.callCount).toBe(2);
  });

  it('does not trigger the watcher when the dependency is called from inside an async function', async () => {
    const reactiveObject = reactive({ foo: 'bar' });
    const asyncFunction = () => new Promise((resolve) => {
      setTimeout(() => resolve(reactiveObject.foo), 0);
    });
    const mock = createMock(asyncFunction);
    watch(mock);
    expect(mock.callCount).toBe(1);
    reactiveObject.foo = 'baz';
    await nextTick();
    expect(mock.callCount).toBe(1);
  });
});

describe('reactive', () => {
  it('is triggered when a property gets deleted', async () => {
    const reactiveObject = reactive({ foo: 'bar' });
    const mock = createMock(() => reactiveObject.foo);
    watch(mock);
    expect(mock.callCount).toBe(1);
    delete reactiveObject.foo;
    await nextTick();
    expect(mock.callCount).toBe(2);
  });

  it('is triggered when a new property gets added', async () => {
    const reactiveObject = reactive({ foo: 'bar' });
    const mock = createMock(() => reactiveObject.anotherProperty);
    watch(mock);
    expect(mock.callCount).toBe(1);
    reactiveObject.anotherProperty = 1337;
    await nextTick();
    expect(mock.callCount).toBe(2);
  });

  it('is NOT triggered for changes on nested properties that are not a direct dependency', async () => {
    const reactiveObject = reactive({ foo: 'bar' });
    const mock = createMock(() => reactiveObject);
    watch(mock);
    expect(mock.callCount).toBe(1);
    reactiveObject.foo = 1337;
    await nextTick();
    expect(mock.callCount).toBe(1);
  });

  it('can be used with arrays', async () => {
    const reactiveArray = reactive([1, 2, 3]);
    const mock = createMock(() => reactiveArray.join(', '));
    watch(mock);
    expect(mock.callCount).toBe(1);
    reactiveArray[1] = 4;
    await nextTick();
    expect(mock.callCount).toBe(2);
  });

  it('can be converted to JSON and back', async () => {
    const reactiveObject = reactive({
      foo: [1, 2, 3],
      bar: 'baz',
      nested: {
        key: 'value',
      },
    });
    watch(() => reactiveObject.nested.key);
    expect(JSON.parse(JSON.stringify(reactiveObject))).toStrictEqual({
      foo: [1, 2, 3],
      bar: 'baz',
      nested: {
        key: 'value',
      },
    });
  });
});

describe('computed', () => {
  it('returns a ref that synchronously holds the computed value', () => {
    const foo = ref('foo');
    const bar = ref('bar');
    const foobar = computed(() => foo.value + bar.value);
    expect(foobar.value).toBe('foobar');
    bar.value = 'baz';
    expect(foobar.value).toBe('foobaz');
  });

  it('raises an error when the computed function includes a reactive assignment', () => {
    const foo = ref(0);
    const bar = ref(1);
    computed(() => {
      foo.value = bar.value;
      bar.value = foo.value + bar.value;
      return bar.value;
    });
    expect(() => { foo.value += 1; }).toThrow(ReactivityErrors.RecursiveWatch);
  });
});
