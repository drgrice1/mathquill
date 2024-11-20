/* global suite, test, assert, setup, MQ */

import { prayWellFormed } from 'src/constants';

suite('backspace', () => {
	let mq, rootBlock, controller, cursor;
	setup(() => {
		const field = document.createElement('span');
		document.getElementById('mock')?.append(field);
		mq = MQ.MathField(field);
		rootBlock = mq.__controller.root;
		controller = mq.__controller;
		cursor = controller.cursor;
	});

	const prayWellFormedPoint = (pt) => prayWellFormed(pt.parent, pt.left, pt.right);
	const assertLatex = (latex) => {
		prayWellFormedPoint(mq.__controller.cursor);
		assert.equal(mq.latex(), latex);
	};

	test('backspace through exponent', () => {
		controller.renderLatexMath('x^{nm}');
		const exp = rootBlock.ends.right,
			expBlock = exp.ends.left;
		assert.equal(exp.latex(), '^{nm}', 'right end el is exponent');
		assert.equal(cursor.parent, rootBlock, 'cursor is in root block');
		assert.equal(cursor.left, exp, 'cursor is at the end of root block');

		mq.keystroke('Backspace');
		assert.equal(cursor.parent, expBlock, 'cursor up goes into exponent on backspace');
		assertLatex('x^{nm}');

		mq.keystroke('Backspace');
		assert.equal(cursor.parent, expBlock, 'cursor still in exponent');
		assertLatex('x^n');

		mq.keystroke('Backspace');
		assert.equal(cursor.parent, expBlock, 'still in exponent, but it is empty');
		assertLatex('x^{ }');

		mq.keystroke('Backspace');
		assert.equal(cursor.parent, rootBlock, 'backspace tears down exponent');
		assertLatex('x');
	});

	test('backspace through complex fraction', () => {
		controller.renderLatexMath('1+\\frac{1}{\\frac{1}{2}+\\frac{2}{3}}');

		//first backspace moves to denominator
		mq.keystroke('Backspace');
		assertLatex('1+\\frac{1}{\\frac{1}{2}+\\frac{2}{3}}');

		//first backspace moves to denominator in denominator
		mq.keystroke('Backspace');
		assertLatex('1+\\frac{1}{\\frac{1}{2}+\\frac{2}{3}}');

		//finally delete a character
		mq.keystroke('Backspace');
		assertLatex('1+\\frac{1}{\\frac{1}{2}+\\frac{2}{ }}');

		//destroy fraction
		mq.keystroke('Backspace');
		assertLatex('1+\\frac{1}{\\frac{1}{2}+2}');

		mq.keystroke('Backspace');
		mq.keystroke('Backspace');
		assertLatex('1+\\frac{1}{\\frac{1}{2}}');

		mq.keystroke('Backspace');
		mq.keystroke('Backspace');
		assertLatex('1+\\frac{1}{\\frac{1}{ }}');

		mq.keystroke('Backspace');
		assertLatex('1+\\frac{1}{1}');

		mq.keystroke('Backspace');
		assertLatex('1+\\frac{1}{ }');

		mq.keystroke('Backspace');
		assertLatex('1+1');
	});

	test('backspace through compound subscript', () => {
		mq.latex('x_{2_2}');

		//first backspace goes into the subscript
		mq.keystroke('Backspace');
		assert.equal(mq.latex(), 'x_{2_2}');

		//second one goes into the subscripts' subscript
		mq.keystroke('Backspace');
		assert.equal(mq.latex(), 'x_{2_2}');

		mq.keystroke('Backspace');
		assert.equal(mq.latex(), 'x_{2_{ }}');

		mq.keystroke('Backspace');
		assert.equal(mq.latex(), 'x_2');

		mq.keystroke('Backspace');
		assert.equal(mq.latex(), 'x_{ }');

		mq.keystroke('Backspace');
		assert.equal(mq.latex(), 'x');
	});

	test('backspace through simple subscript', () => {
		mq.latex('x_{2+3}');

		assert.equal(cursor.parent, rootBlock, 'start in the root block');

		//backspace goes down
		mq.keystroke('Backspace');
		assert.equal(mq.latex(), 'x_{2+3}');
		mq.keystroke('Backspace');
		assert.equal(mq.latex(), 'x_{2+}');
		mq.keystroke('Backspace');
		assert.equal(mq.latex(), 'x_2');
		mq.keystroke('Backspace');
		assert.equal(mq.latex(), 'x_{ }');
		mq.keystroke('Backspace');
		assert.equal(mq.latex(), 'x');
	});

	test('backspace through subscript & superscript', () => {
		mq.latex('x_2^{32}');

		//first backspace takes us into the exponent
		mq.keystroke('Backspace');
		assert.equal(mq.latex(), 'x_2^{32}');

		//second backspace is within the exponent
		mq.keystroke('Backspace');
		assert.equal(mq.latex(), 'x_2^3');

		//clear out exponent
		mq.keystroke('Backspace');
		assert.equal(mq.latex(), 'x_2^{ }');

		//unpeel exponent
		mq.keystroke('Backspace');
		assert.equal(mq.latex(), 'x_2');

		//into subscript
		mq.keystroke('Backspace');
		assert.equal(mq.latex(), 'x_2');

		//clear out subscript
		mq.keystroke('Backspace');
		assert.equal(mq.latex(), 'x_{ }');

		//unpeel exponent
		mq.keystroke('Backspace');
		assert.equal(mq.latex(), 'x');

		//clear out math field
		mq.keystroke('Backspace');
		assert.equal(mq.latex(), '');
	});

	test('backspace through nthroot', () => {
		mq.latex('\\sqrt[3]{x}');

		//first backspace takes us inside the nthroot
		mq.keystroke('Backspace');
		assert.equal(mq.latex(), '\\sqrt[3]{x}');

		//second backspace removes the x
		mq.keystroke('Backspace');
		assert.equal(mq.latex(), '\\sqrt[3]{}');

		//third one destroys the cube root, but leaves behind the 3
		mq.keystroke('Backspace');
		assert.equal(mq.latex(), '3');

		mq.keystroke('Backspace');
		assert.equal(mq.latex(), '');
	});

	test('backspace through large operator', () => {
		mq.latex('\\sum_{n=1}^3x');

		//first backspace takes out the argument
		mq.keystroke('Backspace');
		assert.equal(mq.latex(), '\\sum_{n=1}^3');

		//up into the superscript
		mq.keystroke('Backspace');
		assert.equal(mq.latex(), '\\sum_{n=1}^3');

		//up into the superscript
		mq.keystroke('Backspace');
		assert.equal(mq.latex(), '\\sum_{n=1}^{ }');

		//destroy the sum, preserve the subscript (a little surprising)
		mq.keystroke('Backspace');
		assert.equal(mq.latex(), 'n=1');
	});

	test('backspace through text block', () => {
		mq.latex('\\text{x}');

		mq.keystroke('Backspace');

		const textBlock = rootBlock.ends.right;
		assert.equal(cursor.parent, textBlock, 'cursor is in text block');
		assert.equal(cursor.right, undefined, 'cursor is at the end of text block');
		assert.equal(cursor.left.text(), 'x', 'cursor is rightward of the x');
		assert.equal(mq.latex(), '\\text{x}', 'the x has been deleted');

		mq.keystroke('Backspace');
		assert.equal(cursor.parent, textBlock, 'cursor is still in text block');
		assert.equal(cursor.right, undefined, 'cursor is at the right end of the text block');
		assert.equal(cursor.left, undefined, 'cursor is at the left end of the text block');
		assert.equal(mq.latex(), '', 'the x has been deleted');

		mq.keystroke('Backspace');
		assert.equal(cursor.right, undefined, 'cursor is at the right end of the root block');
		assert.equal(cursor.left, undefined, 'cursor is at the left end of the root block');
		assert.equal(mq.latex(), '');
	});

	suite('empties', () => {
		test('backspace empty exponent', () => {
			mq.latex('x^{}');
			mq.keystroke('Backspace');
			assert.equal(mq.latex(), 'x');
		});

		test('backspace empty sqrt', () => {
			mq.latex('1+\\sqrt{}');
			mq.keystroke('Backspace');
			assert.equal(mq.latex(), '1+');
		});

		test('backspace empty fraction', () => {
			mq.latex('1+\\frac{}{}');
			mq.keystroke('Backspace');
			assert.equal(mq.latex(), '1+');
		});
	});
});
