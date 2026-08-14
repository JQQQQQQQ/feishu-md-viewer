import * as vscode from 'vscode';
import { MarkdownPreviewProvider, MARKDOWN_PREVIEW_VIEW_TYPE } from './MarkdownPreviewProvider';

export function activate(context: vscode.ExtensionContext): void {
  const provider = new MarkdownPreviewProvider(context.extensionUri);
  const registration = vscode.window.registerCustomEditorProvider(MARKDOWN_PREVIEW_VIEW_TYPE, provider);
  const reopenWithTextEditor = vscode.commands.registerCommand(
    'feishu-md-viewer.reopenWithTextEditor',
    () => {
      void vscode.commands.executeCommand('workbench.action.reopenTextEditor');
    },
  );

  context.subscriptions.push(registration, reopenWithTextEditor);
}
