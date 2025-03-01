describe('Basic Jest Test Suite', () => {
  test('should pass a simple addition test', () => {
    expect(1 + 1).toBe(2);
  });

  test('should correctly check string equality', () => {
    expect('hello').toBe('hello');
  });

  test('should verify array contents', () => {
    const arr = [1, 2, 3];
    expect(arr).toHaveLength(3);
    expect(arr).toContain(2);
  });

  test('should check object properties', () => {
    const obj = { name: 'test', value: 42 };
    expect(obj).toHaveProperty('name');
    expect(obj.value).toBe(42);
  });
});
