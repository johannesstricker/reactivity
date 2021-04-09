# reactivity

[![Tests](https://github.com/johannesstricker/reactivity/workflows/Testing/badge.svg)](https://github.com/johannesstricker/reactivity/actions)

Reactivity tools inspired by Vue's reactivity system. I've created the library to support some smaller projects, to which I didn't want to add Vue.

## How to use

The functions work similar to their Vue counterparts.

```javascript
import { reactive, ref, computed, watch } from 'reactivity';

// use ref() to create reactive primitives
const reactiveCounter = ref(0);

// the function you pass to watch() will re-run when any
// of its reactive dependencies changes
watch(() => {
  console.log(`Counter value is: ${reactiveCounter.value}`);
});
// -> Counter value is: 0
reactiveCounter.value += 1;
// -> Counter value is: 1
reactiveCounter.value += 1;
// -> Counter value is: 2

// use reactive() to create reactive objects or arrays
const reactiveObject = reactive({
  firstName: 'John',
  lastName: 'Doe',
});

// computed() returns a ref that will be updated whenever
// any of its reactive dependencies change
const fullName = computed(() => (
  `${reactiveObject.firstName} ${reactiveObject.lastName}`));
console.log(`Full name is ${fullName.value}`);
// -> Full name is John Doe

reactiveObject.firstName = 'Jane';
console.log(`Full name is ${fullName.value}`);
// -> Full name is Jane Doe
```