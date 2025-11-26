import answers from '../src/ai/answers.js';
const { isAnswerCorrect } = answers;

function t(name, a) {
    console.log(`${a ? 'PASS' : 'FAIL'}: ${name}`);
    if (!a) process.exitCode = 2;
}

console.log('Testing isAnswerCorrect helper...');

// Numeric exact
t('5 vs 5', isAnswerCorrect(5, '5'));
// Numeric float tolerance
t('5 vs 4.99', isAnswerCorrect(5, '4.99'));
// Numeric string parse
t('5 vs "5"', isAnswerCorrect('5', '5'));
// Text exact
t('apple vs apple', isAnswerCorrect('apple', 'apple'));
// Text fuzz
t('colour vs color', isAnswerCorrect('color', 'colour'));
// Text fuzzy small typo
t('Washington vs Washngton', isAnswerCorrect('Washington', 'Washngton'));

// Word-number parsing
t('twenty five -> 25', isAnswerCorrect(25, 'twenty five'));
t('one hundred twenty three -> 123', isAnswerCorrect(123, 'one hundred twenty three'));
t('two thousand -> 2000', isAnswerCorrect(2000, 'two thousand'));
t('one hundred and five -> 105', isAnswerCorrect(105, 'one hundred and five'));

console.log('Done.');
