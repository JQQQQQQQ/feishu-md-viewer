import * as vscode from 'vscode';
import { MarkdownPreviewProvider, MARKDOWN_PREVIEW_VIEW_TYPE } from './MarkdownPreviewProvider';

export function activate(context: vscode.ExtensionContext): void {
  const provider = new MarkdownPreviewProvider();
  const registration = vscode.window.registerCustomEditorProvider(MARKDOWN_PREVIEW_VIEW_TYPE, provider);

  context.subscriptions.push(registration);
}
