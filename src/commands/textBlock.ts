// The block for abstract classes of text blocks

import type { Controller } from 'src/controller';
import type { Cursor } from 'src/cursor';
import { RootMathBlock } from 'commands/mathBlock';
import { VanillaSymbol } from 'commands/mathElements';
import { RootMathCommand } from 'commands/mathBlock';

export class RootTextBlock extends RootMathBlock {
	keystroke(key: string, e: Event, ctrlr: Controller) {
		if (key === 'Spacebar' || key === 'Shift-Spacebar') return;
		return super.keystroke(key, e, ctrlr);
	}

	write(cursor: Cursor, ch: string) {
		cursor.show().deleteSelection();
		if (ch === '$')
			new RootMathCommand(cursor).createLeftOf(cursor);
		else {
			new VanillaSymbol(ch, ch === '<' ? '&lt;' : ch === '>' ? '&gt;' : undefined).createLeftOf(cursor);
		}
	}
}
