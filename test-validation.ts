import { checkDuplicateMRN, validateDate, validateIPCase } from './src/lib/validators';

console.log('🧪 Testing Validators...\n');

const futureDate = new Date();
futureDate.setDate(futureDate.getDate() + 10);
const error1 = validateDate(futureDate.toISOString().split('T')[0], 'Test date');
console.assert(error1 !== null, '✓ Test 1 PASSED: Future dates rejected');

const invalidCase = { mrn: '12345' };
const validation = validateIPCase(invalidCase);
console.assert(!validation.valid, '✓ Test 2 PASSED: Invalid cases caught');

const residents = [{ mrn: 'TEST001' } as any];
const isDuplicate = checkDuplicateMRN('TEST001', residents);
console.assert(isDuplicate === true, '✓ Test 3 PASSED: Duplicates detected');

console.log('\n✅ All validation tests passed!');
