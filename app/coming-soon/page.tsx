import Image from 'next/image';
import Link from 'next/link';
import { siX, siTelegram, siGmail } from 'simple-icons/icons'

interface IconProps {
  path: string;
  title?: string;
}

interface SimpleIconProps {
  icon: IconProps;
  size?: number | string;
  className?: string;
}

export const SimpleIcon: React.FC<SimpleIconProps> = ({
  icon,
  size = 24,
  className = 'text-white'
}) => {
  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d={icon.path} />
    </svg>
  );
};



export default function ComingSoon() {
  const socialLinks = [
    { icon: <SimpleIcon icon={siX} size={20} />, href: 'https://x.com/FaucetDrops', label: 'Twitter' },
    { icon: <SimpleIcon icon={siTelegram} size={20} />, href: 'https://t.me/FaucetDropschat', label: 'Telegram' },
    { icon: <SimpleIcon icon={siGmail} size={20} />, href: 'mailto:drops.faucet@gmail.com', label: 'Email' },
  ];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-white p-6">
      <div className="max-w-2xl w-full text-center space-y-8">
        <div className="relative w-48 h-48 mx-auto">
          <Image
            src="/white_FaucetDrops.png"
            alt="FaucetDrops Logo"
            fill
            className="object-contain"
          />
        </div>

        <div className="space-y-4">
          <h1 className="text-4xl md:text-5xl font-bold text-white">Coming Soon</h1>
          <p className="text-xl text-muted-foreground">
            We&apos;re working on something amazing!
          </p>
          <p className="text-muted-foreground">
            This page is under construction. Please check back later for updates.
          </p>
        </div>

        <div className="pt-4">
          <div className="inline-flex items-center px-6 py-3 rounded-md bg-white/10 text-white font-medium">
            <span className="relative flex h-3 w-3 mr-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white/75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
            </span>
            Under Development
          </div>
        </div>

        {/* Social Media Links */}
        <div className="pt-8">
          <p className="text-sm text-muted-foreground">
            In the meantime, you can follow us on social media or contact out team
          </p>
        <div className="flex justify-center space-x-6 pt-4">
          {socialLinks.map((social, index) => (
            <a
              key={index}
              href={social.href}
              target="_blank"
              rel="noopener noreferrer"
              className={`p-2 rounded-full hover:bg-gray-800`}
              aria-label={social.label}
            >
              {social.icon}
            </a>
          ))}
        </div>
        </div>

        <div className="pt-8">
          <p className="text-sm text-muted-foreground">
            In the meantime, you can check out our
            <Link href="/" className="text-white hover:underline"> homepage</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}
