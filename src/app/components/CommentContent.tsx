import { MarkdownBlockNote } from './markdown';
import { CommentPlainWithMentions } from './CommentPlainWithMentions';
import { commentHasMentions } from '../utils/commentMentions';

type Props = {
  commentId: string;
  content: string;
};

export function CommentContent({ commentId, content }: Props) {
  const text = String(content || '');
  if (commentHasMentions(text)) {
    return <CommentPlainWithMentions content={text} />;
  }
  return (
    <MarkdownBlockNote instanceKey={`comment-view-${commentId}`} markdown={text} compact />
  );
}
