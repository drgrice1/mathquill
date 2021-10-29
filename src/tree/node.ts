// Node base class of edit tree-related objects

import type JQuery from 'jquery';
import type { Constructor, Direction } from 'src/constants';
import { jQuery, L, R, iterator, pray, prayDirection, mqCmdId, mqBlockId } from 'src/constants';
import type { Options } from 'src/options';
import type { Controller } from 'src/controller';
import type { Cursor } from 'src/cursor';
import { Selection } from 'src/selection';
import { Fragment } from 'tree/fragment';

export interface Ends {
	[L]?: Node;
	[R]?: Node;
}

const prayOverridden = () => pray('overridden or never called on this node');

export interface NodeConstructor {
	new (...args: Array<any>): Node;
}

// MathQuill virtual-DOM tree-node abstract base class
// Only doing tree node manipulation via these adopt/disown methods guarantees well-formedness of the tree.
export class Node {
	static id = 0;
	static byId: { [key: number]: Node } = {};
	static uniqueNodeId = () => ++Node.id;

	jQ: JQuery = jQuery();
	id: number;
	parent?: Node;
	ends: Ends = {};
	[L]?: Node;
	[R]?: Node;
	controller?: Controller;

	ctrlSeq = '';
	siblingDeleted?: (opts: Options, dir?: Direction) => void;
	siblingCreated?: (opts: Options, dir?: Direction) => void;
	sub?: Node;
	sup?: Node;
	isSymbol?: boolean;
	isSupSubLeft?: boolean;

	upInto?: Node;
	downInto?: Node;
	upOutOf?: ((dir: Direction) => void) | ((cursor: Cursor) => void) | Node | boolean;
	downOutOf?: ((dir: Direction) => void) | ((cursor: Cursor) => void) | Node | boolean;

	reflow?: () => void;

	bubble = iterator((yield_: (node: Node) => Node | boolean) => {
		// eslint-disable-next-line @typescript-eslint/no-this-alias
		for (let ancestor: Node | undefined = this; ancestor; ancestor = ancestor.parent) {
			if (yield_(ancestor) === false) break;
		}

		return this;
	});;

	postOrder = iterator((yield_: (node: Node) => Node | boolean) => {
		(function recurse(descendant: Node) {
			descendant.eachChild(recurse);
			yield_(descendant);
		})(this);

		return this;
	});;

	constructor() {
		this.id = Node.uniqueNodeId();
		Node.byId[this.id] = this;
	}

	dispose() { delete Node.byId[this.id]; }

	toString() { return `{{ MathQuill Node #${this.id} }}`; }

	jQadd(jQ: JQuery | HTMLElement) { this.jQ = this.jQ.add(jQ); }

	jQize(jQ?: JQuery) {
		// jQuery-ifies this.html() and links up the .jQ of all corresponding Nodes
		const jQlocal = jQ ? jQuery(jQ) : jQuery(this.html());

		const jQadd = (el: HTMLElement) => {
			if (el.getAttribute) {
				const cmdId = parseInt(el.getAttribute(mqCmdId) ?? '0');
				const blockId = parseInt(el.getAttribute(mqBlockId) ?? '0');
				if (cmdId) Node.byId[cmdId].jQadd(el);
				if (blockId) Node.byId[blockId].jQadd(el);
			}
			for (let child = el.firstChild; child; child = child.nextSibling) {
				jQadd(child as HTMLElement);
			}
		};

		jQlocal.each((index, element) => jQadd(element));
		return jQlocal;
	}

	createDir(dir: Direction, cursor: Cursor) {
		prayDirection(dir);
		this.jQize();
		this.jQ.insDirOf(dir, cursor.jQ);
		cursor[dir] = this.adopt(cursor.parent as Node, cursor[L], cursor[R]);
		return this;
	}

	createLeftOf(el: Cursor) { this.createDir(L, el); }

	selectChildren(leftEnd?: Node, rightEnd?: Node) {
		return new Selection(leftEnd, rightEnd);
	}

	isEmpty() {
		return !this.ends[L] && !this.ends[R];
	}

	isStyleBlock() {
		return false;
	}

	children() {
		return new Fragment(this.ends[L], this.ends[R]);
	}

	eachChild(method: 'postOrder' | ((node: Node) => boolean) | ((node: Node) => void), order?: string) {
		const children = this.children();
		children.each(method, order);
		return this;
	}

	foldChildren<T>(fold: T, fn: ((fold: T, child: Node) => T)): T {
		return this.children().fold<T>(fold, fn);
	}

	withDirAdopt(dir: Direction, parent: Node, withDir?: Node, oppDir?: Node) {
		new Fragment(this, this).withDirAdopt(dir, parent, withDir, oppDir);
		return this;
	}

	adopt(parent: Node, leftward?: Node, rightward?: Node) {
		new Fragment(this, this).adopt(parent, leftward, rightward);
		return this;
	}

	disown() {
		new Fragment(this, this).disown();
		return this;
	};

	remove() {
		this.jQ.remove();
		this.postOrder('dispose');
		return this.disown();
	}

	// Methods that deal with the browser DOM events from interaction with the typist.

	keystroke(key: string, e: Event, ctrlr: Controller) {
		const cursor = ctrlr.cursor;

		switch (key) {
		case 'Ctrl-Shift-Backspace':
		case 'Ctrl-Backspace':
			ctrlr.ctrlDeleteDir(L);
			break;

		case 'Shift-Backspace':
		case 'Backspace':
			ctrlr.backspace();
			break;

		// Tab or Esc -> go one block right if it exists, else escape right.
		case 'Esc':
		case 'Tab':
			ctrlr.escapeDir(R, key, e);
			return;

		// Shift-Tab -> go one block left if it exists, else escape left.
		case 'Shift-Tab':
		case 'Shift-Esc':
			ctrlr.escapeDir(L, key, e);
			return;

		// End -> move to the end of the current block.
		case 'End':
			ctrlr.notify('move').cursor.insAtRightEnd(cursor.parent as Node);
			break;

		// Ctrl-End -> move all the way to the end of the root block.
		case 'Ctrl-End':
			ctrlr.notify('move').cursor.insAtRightEnd(ctrlr.root);
			break;

		// Shift-End -> select to the end of the current block.
		case 'Shift-End':
			while (cursor[R]) {
				ctrlr.selectRight();
			}
			break;

		// Ctrl-Shift-End -> select to the end of the root block.
		case 'Ctrl-Shift-End':
			while (cursor[R] || cursor.parent !== ctrlr.root) {
				ctrlr.selectRight();
			}
			break;

		// Home -> move to the start of the root block or the current block.
		case 'Home':
			ctrlr.notify('move').cursor.insAtLeftEnd(cursor.parent as Node);
			break;

		// Ctrl-Home -> move to the start of the current block.
		case 'Ctrl-Home':
			ctrlr.notify('move').cursor.insAtLeftEnd(ctrlr.root);
			break;

		// Shift-Home -> select to the start of the current block.
		case 'Shift-Home':
			while (cursor[L]) {
				ctrlr.selectLeft();
			}
			break;

		// Ctrl-Shift-Home -> move to the start of the root block.
		case 'Ctrl-Shift-Home':
			while (cursor[L] || cursor.parent !== ctrlr.root) {
				ctrlr.selectLeft();
			}
			break;

		case 'Left': ctrlr.moveLeft(); break;
		case 'Shift-Left': ctrlr.selectLeft(); break;
		case 'Ctrl-Left': break;

		case 'Right': ctrlr.moveRight(); break;
		case 'Shift-Right': ctrlr.selectRight(); break;
		case 'Ctrl-Right': break;

		case 'Up': ctrlr.moveUp(); break;
		case 'Down': ctrlr.moveDown(); break;

		case 'Shift-Up':
			if (cursor[L]) {
				while (cursor[L]) ctrlr.selectLeft();
			} else {
				ctrlr.selectLeft();
			}
			break;

		case 'Shift-Down':
			if (cursor[R]) {
				while (cursor[R]) ctrlr.selectRight();
			}
			else {
				ctrlr.selectRight();
			}
			break;

		case 'Ctrl-Up': break;
		case 'Ctrl-Down': break;

		case 'Ctrl-Shift-Del':
		case 'Ctrl-Del':
			ctrlr.ctrlDeleteDir(R);
			break;

		case 'Shift-Del':
		case 'Del':
			ctrlr.deleteForward();
			break;

		case 'Meta-A':
		case 'Ctrl-A':
			ctrlr.notify('move').cursor.insAtRightEnd(ctrlr.root);
			while (cursor[L]) ctrlr.selectLeft();
			break;

		default:
			return;
		}
		e.preventDefault();
		ctrlr.scrollHoriz();
	}

	html() { return ''; }
	text() { return ''; }
	latex() { return ''; }
	focus() { /* do nothing */ }
	blur(_ignore_cursor?: Cursor) { /* do nothing */ }
	seek(_ignore_left: number, _ignore_cursor: Cursor) { /* do nothing */ }
	writeLatex(_ignore_cursor: Cursor, _ignore_latex: string) { /* do nothing */ }
	finalizeInsert(_ignore_options: Options, _ignore_cursor?: Cursor) { /* do nothing */ }
	write(_ignore_cursor: Cursor, _ignore_ch: string) { /* do nothing */ }
	replaces(_ignore_fragment?: string | Fragment) { /* do nothing */ }
	setOptions(_ignore_options: { text?: () => string, htmlTemplate?: string, latex?: () => string }) { return this; }
	chToCmd(_ignore_ch: string, _ignore_options: Options): Node { return this; }

	// called by Controller::escapeDir, moveDir
	moveOutOf(_ignore_dir: Direction, _ignore_cursor?: Cursor, _ignore_updown?: 'up' | 'down') { prayOverridden(); }
	// called by Controller::moveDir
	moveTowards(_ignore_dir: Direction, _ignore_cursor: Cursor, _ignore_updown?: 'up' | 'down') { prayOverridden(); }
	// called by Controller::deleteDir
	deleteOutOf(_ignore_dir: Direction, _ignore_cursor?: Cursor) { prayOverridden(); }
	// called by Controller::deleteDir
	deleteTowards(_ignore_dir: Direction, _ignore_cursor: Cursor) { prayOverridden(); }
	// called by Controller::selectDir
	unselectInto(_ignore_dir: Direction, _ignore_cursor: Cursor) { prayOverridden(); }
	// called by Controller::selectDir
	selectOutOf(_ignore_dir: Direction, _ignore_cursor?: Cursor) { prayOverridden(); }
	// called by Controller::selectDir
	selectTowards(_ignore_dir: Direction, _ignore_cursor: Cursor) { prayOverridden(); }
}

export type Nodeable = Constructor<Node>;
