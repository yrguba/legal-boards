import { resolveUserAvatarUrl } from '../utils/userAvatar';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { cn } from './ui/utils';

type UserAvatarSize = 'sm' | 'md' | 'lg';

const sizeClasses: Record<UserAvatarSize, string> = {
  sm: 'size-7 text-xs',
  md: 'size-8 text-sm',
  lg: 'size-10 text-sm',
};

type Props = {
  name: string;
  avatar?: string | null;
  size?: UserAvatarSize;
  className?: string;
};

export function UserAvatar({ name, avatar, size = 'md', className }: Props) {
  const avatarUrl = resolveUserAvatarUrl(avatar);
  const initial = name.trim().charAt(0) || '?';

  return (
    <Avatar className={cn(sizeClasses[size], 'shrink-0', className)}>
      {avatarUrl ? <AvatarImage src={avatarUrl} alt={name} /> : null}
      <AvatarFallback className="bg-brand-light font-medium text-brand">{initial}</AvatarFallback>
    </Avatar>
  );
}
