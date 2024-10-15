import type { Direction, Constructor } from 'src/constants';
import { L, R, LatexCmds, CharCmds } from 'src/constants';
import { RootBlockMixin } from 'src/mixins';
import type { Options } from 'src/options';
import type { Controller } from 'src/controller';
import type { Cursor } from 'src/cursor';
import type { TNode } from 'tree/node';
import { Parser } from 'services/parser.util';
import { BlockFocusBlur } from 'services/focusBlur';
import { VanillaSymbol, MathElement, MathCommand, Letter, Digit, latexMathParser } from 'commands/mathElements';

// The MathBlock and the RootMathCommand (used by the RootTextBlock) use this.
export const writeMethodMixin = <TBase extends Constructor<TNode>>(Base: TBase) =>
	class extends Base {
		writeHandler?: (cursor: Cursor, ch: string) => boolean;

		chToCmd(ch: string, options: Options): TNode {
			const cons = CharCmds[ch] || LatexCmds[ch];
			// exclude f because it gets a dedicated command with more spacing
			if (/^[a-eg-zA-Z]$/.exec(ch)) return new Letter(ch);
			else if (/^\d$/.test(ch)) return new Digit(ch);
			else if (options && options.typingSlashWritesDivisionSymbol && ch === '/')
				return new LatexCmds['\u00f7'](ch);
			else if (options && options.typingAsteriskWritesTimesSymbol && ch === '*')
				return new LatexCmds['\u00d7'](ch);
			else if (cons) return new cons(ch);
			else return new VanillaSymbol(ch);
		}

		write(cursor: Cursor, ch: string) {
			if (this.writeHandler?.(cursor, ch)) return;

			if (this.isSupSubLeft) {
				if (cursor.options.autoSubscriptNumerals && this === this.parent?.sub) {
					if (ch === '_') return;
					const cmd = this.chToCmd(ch, cursor.options);
					if (cmd.isSymbol) cursor.deleteSelection();
					else cursor.clearSelection().insRightOf(this.parent);
					cmd.createLeftOf(cursor.show());
					return;
				}
				if (
					cursor[L] &&
					!cursor[R] &&
					!cursor.selection &&
					cursor.options.charsThatBreakOutOfSupSub.includes(ch)
				) {
					cursor.insRightOf(this.parent!);
				}
			}

			const cmd = this.chToCmd(ch, cursor.options);
			if (cursor.selection) cmd.replaces(cursor.replaceSelection());
			if (!cursor.isTooDeep()) cmd.createLeftOf(cursor.show());
		}
	};

// Children and parent of MathCommand's. Basically partitions all the
// symbols and operators that descend (in the Math DOM tree) from
// ancestor operators.
export class MathBlock extends BlockFocusBlur(writeMethodMixin(MathElement)) {
	join(methodName: keyof Pick<TNode, 'text' | 'latex' | 'html'>) {
		return this.foldChildren('', (fold, child) => fold + child[methodName]());
	}

	html() {
		return this.join('html');
	}

	latex() {
		return this.join('latex');
	}

	text() {
		return this.ends[L] && this.ends[L] === this.ends[R] ? (this.ends[L]?.text() ?? '') : this.join('text');
	}

	keystroke(key: string, e: KeyboardEvent, ctrlr: Controller) {
		if (
			ctrlr.options.spaceBehavesLikeTab &&
			ctrlr.cursor.depth() > 1 &&
			(key === 'Spacebar' || key === 'Shift-Spacebar') &&
			ctrlr.cursor[L]?.ctrlSeq !== ','
		) {
			e.preventDefault();
			ctrlr.escapeDir(key === 'Shift-Spacebar' ? L : R, key, e);
			return;
		}
		return super.keystroke(key, e, ctrlr);
	}

	// editability methods: called by the cursor for editing, cursor movements,
	// and selection of the MathQuill tree, these all take in a direction and
	// the cursor
	moveOutOf(dir: Direction, cursor: Cursor, updown?: 'up' | 'down') {
		const updownInto = updown && this.parent?.[`${updown}Into`];
		if (!updownInto && this[dir]) cursor.insAtDirEnd(dir === L ? R : L, this[dir]);
		else cursor.insDirOf(dir, this.parent!);
	}

	selectOutOf(dir: Direction, cursor: Cursor) {
		cursor.insDirOf(dir, this.parent!);
	}

	deleteOutOf(_dir: Direction, cursor: Cursor) {
		cursor.unwrapGramp();
	}

	seek(pageX: number, cursor: Cursor) {
		let node = this.ends[R];
		const rect = node?.elements.firstElement.getBoundingClientRect() ?? undefined;
		if (!node || (rect?.left ?? 0) + (rect?.width ?? 0) < pageX) {
			cursor.insAtRightEnd(this);
			return;
		}
		if (pageX < (this.ends[L]?.elements.firstElement.getBoundingClientRect().left ?? 0)) {
			cursor.insAtLeftEnd(this);
			return;
		}
		while (pageX < (node?.elements.firstElement.getBoundingClientRect().left ?? 0)) node = node?.[L];
		node?.seek(pageX, cursor);
	}

	writeLatex(cursor: Cursor, latex: string) {
		const all = Parser.all;
		const eof = Parser.eof;

		const block: MathCommand = latexMathParser.skip(eof).or(all.result(false)).parse(latex);

		if (block && !block.isEmpty() && block.prepareInsertionAt(cursor)) {
			block.children().adopt(cursor.parent!, cursor[L], cursor[R]);
			const elements = block.domify();
			cursor.element.before(...elements.contents);
			cursor[L] = block.ends[R];
			block.finalizeInsert(cursor.options, cursor);
			block.ends[R]?.[R]?.siblingCreated?.(cursor.options, L);
			block.ends[L]?.[L]?.siblingCreated?.(cursor.options, R);
			cursor.parent?.bubble('reflow');
		}
	}

	focus() {
		super.focus();
		return this;
	}

	blur() {
		super.blur();
		return this;
	}
}

export class RootMathBlock extends MathBlock {
	constructor() {
		super();
		RootBlockMixin(this);
	}
}

export class RootMathCommand extends writeMethodMixin(MathCommand) {
	cursor: Cursor;

	constructor(cursor: Cursor) {
		super('$');
		this.cursor = cursor;
		this.htmlTemplate = '<span class="mq-math-mode">&0</span>';
	}

	createBlocks() {
		super.createBlocks();

		const leftEnd = this.ends[L] as RootMathCommand;
		leftEnd.write = (cursor: Cursor, ch: string) => {
			if (ch !== '$') this.write(cursor, ch);
			else if (leftEnd.isEmpty()) {
				cursor.insRightOf(leftEnd.parent!);
				leftEnd.parent?.deleteTowards(L, cursor);
				new VanillaSymbol('\\$', '$').createLeftOf(cursor.show());
			} else if (!cursor[R]) cursor.insRightOf(leftEnd.parent!);
			else if (!cursor[L]) cursor.insLeftOf(leftEnd.parent!);
			else this.write(cursor, ch);
		};
	}

	latex() {
		return `$${this.ends[L]?.latex() ?? ''}$`;
	}
}
