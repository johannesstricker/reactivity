const {
  reactive,
  ref,
  watch,
  debounce,
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

describe('reactivity', () => {
  describe('watch', () => {
    it('runs the watch function debounced once', async () => {
      const mock = createMock();
      watch(mock);
      await nextTick();
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

    it('runs debounced once and then reruns the function whenever any of the dependencies change', async () => {
      const reactiveObject = reactive({ foo: 'bar' });
      const reactiveValue = ref(5);

      const mock = createMock(() => {
        if (reactiveObject.foo === undefined) { return false; }
        if (reactiveValue.value === undefined) { return false; }
        return true;
      });
      watch(mock);

      await nextTick();
      expect(mock.callCount).toBe(1);
      reactiveObject.foo = 'bazz';
      await nextTick();
      expect(mock.callCount).toBe(2);
      reactiveValue.value = 6;
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
      await nextTick();
      expect(mock.callCount).toBe(1);
      reactiveObject.foo.two = '3';
      await nextTick();
      expect(mock.callCount).toBe(1);
      reactiveObject.foo.one = '2';
      await nextTick();
      expect(mock.callCount).toBe(2);
    });
  });

  describe('reactive', () => {
    it('can be used on arrays', async () => {
      const reactiveArray = reactive([1, 2, 3]);
      const mock = createMock(() => reactiveArray.join(', '));
      watch(mock);
      await nextTick();
      expect(mock.callCount).toBe(1);
      reactiveArray[1] = 4;
      await nextTick();
      expect(mock.callCount).toBe(2);
    });
  });

  describe('debounce', () => {
    it('runs the function once at the start of the next event loop', async () => {
      const mock = createMock();
      const increaseCallCountDebounced = debounce(mock);
      increaseCallCountDebounced();
      await nextTick();
      expect(mock.callCount).toBe(1);
      increaseCallCountDebounced();
      increaseCallCountDebounced();
      increaseCallCountDebounced();
      await nextTick();
      expect(mock.callCount).toBe(2);
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
      // expect(createComputedValue).toThrow(ReactivityErrors.ComputedAssignment);
      expect(() => { foo.value += 1; }).toThrow(ReactivityErrors.RecursiveWatch);
    });
  });
});
