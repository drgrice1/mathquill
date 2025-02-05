// Input box to type backslash commands

import { LatexCmds, CharCmds } from 'src/constants';
import type { Controller } from 'src/controller';
import type { Cursor } from 'src/cursor';
import type { Fragment } from 'tree/fragment';
import { VNode } from 'tree/vNode';
import { VanillaSymbol, MathCommand } from 'commands/mathElements';
import { TextBlock } from 'commands/textElements';

CharCmds['\\'] = class LatexCommandInput extends MathCommand {
	_replacedFragment?: Fragment;

	constructor() {
		super();
		this.ctrlSeq = '\\';
		this.htmlTemplate = '<span class="mq-latex-command-input mq-non-leaf">\\<span>&0</span></span>';
		this.textTemplate = ['\\'];
	}

	replaces(replacedFragment?: Fragment) {
		this._replacedFragment = replacedFragment?.disown();
		this.isEmpty = () => false;
	}

	createBlocks() {
		super.createBlocks();

		const leftEnd = this.ends.left;

		if (!leftEnd) return;

		leftEnd.focus = () => {
			leftEnd.parent?.elements.addClass('mq-has-cursor');
			if (leftEnd.isEmpty()) leftEnd.parent?.elements.removeClass('mq-empty');

			return leftEnd;
		};

		leftEnd.blur = () => {
			leftEnd.parent?.elements.removeClass('mq-has-cursor');
			if (leftEnd.isEmpty()) leftEnd.parent?.elements.addClass('mq-empty');

			return leftEnd;
		};

		leftEnd.write = (cursor: Cursor, ch: string) => {
			cursor.show().deleteSelection();

			if (/[a-z]/i.exec(ch)) {
				new VanillaSymbol(ch).createLeftOf(cursor);
				cursor.controller.aria.alert(ch);
			} else {
				const cmd = (leftEnd.parent as LatexCommandInput).renderCommand(cursor);
				cursor.controller.aria.queue(cmd.mathspeak({ createdLeftOf: cursor }));
				if (ch !== '\\' || !leftEnd.isEmpty()) cursor.parent?.write(cursor, ch);
				else cursor.controller.aria.alert();
			}
		};

		leftEnd.keystroke = (key: string, e: KeyboardEvent, ctrlr: Controller) => {
			if (key === 'Tab' || key === 'Shift-Tab' || key === 'Enter' || key === 'Spacebar') {
				const cmd = (leftEnd.parent as LatexCommandInput).renderCommand(ctrlr.cursor);
				ctrlr.aria.alert(cmd.mathspeak({ createdLeftOf: ctrlr.cursor }));
				e.preventDefault();
				return;
			}
			super.keystroke(key, e, ctrlr);
			return;
		};
	}

	createLeftOf(cursor: Cursor) {
		super.createLeftOf(cursor);

		if (this._replacedFragment) {
			const el = this.elements.first;

			this._replacedFragment.elements.addClass('mq-blur');
			this.elements.first.before(...this._replacedFragment.elements.contents);
			this.elements.add(this._replacedFragment.elements);

			// FIXME: Is monkey-patching the mousedown and mousemove handlers the right way to do this?
			const handler = (e: MouseEvent) => {
				e.stopPropagation();
				e.preventDefault();
				el.dispatchEvent(new MouseEvent(e.type, e));
			};

			this.elements.firstElement.addEventListener('mousedown', handler);
			this.elements.firstElement.addEventListener('mousemove', handler);
		}
	}

	latex() {
		return '\\' + (this.ends.left?.latex() ?? '') + ' ';
	}

	renderCommand(cursor: Cursor) {
		this.elements = new VNode(this.elements.last);
		this.remove();

		if (this.right) cursor.insLeftOf(this.right);
		else if (this.parent) cursor.insAtRightEnd(this.parent);

		const latex = this.ends.left?.latex() || ' ';
		if (latex in LatexCmds) {
			const cmd = new LatexCmds[latex](latex);
			if (this._replacedFragment) cmd.replaces(this._replacedFragment);
			cmd.createLeftOf(cursor);
			return cmd;
		} else {
			const cmd = new TextBlock();
			cmd.replaces(latex);
			cmd.createLeftOf(cursor);
			cursor.insRightOf(cmd);
			if (this._replacedFragment) this._replacedFragment.remove();
			return cmd;
		}
	}
};
