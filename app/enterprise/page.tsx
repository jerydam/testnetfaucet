"use client";
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
    { icon: siX, href: 'https://x.com/FaucetDrops', label: 'Twitter' },
    { icon: siTelegram, href: 'https://t.me/FaucetDropschat', label: 'Telegram' },
    { icon: siGmail, href: 'mailto:drops.faucet@gmail.com', label: 'Email' },
  ];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-white dark:bg-black transition-colors duration-300">
      <div className="max-w-2xl w-full text-center space-y-8">
        
        {/* Logo Section - Adapts to theme */}
        <div className="flex justify-center relative">
          {/* Light Mode Logo: Visible by default, hidden in dark mode */}
          <Image
            src="/lightlogo.png"
            alt="FaucetDrops Logo"
            width={200}
            height={80}
            className="h-12 w-auto sm:h-16 lg:h-20 rounded-md object-contain dark:hidden"
          />
          
          {/* Dark Mode Logo: Hidden by default, visible in dark mode */}
          <Image
            src="/darklogo.png"
            alt="FaucetDrops Logo"
            width={200}
            height={80}
            className="h-12 w-auto sm:h-16 lg:h-20 rounded-md object-contain hidden dark:block"
          />
        </div>

        {/* Heading Section - Theme aware */}
        <div className="space-y-4">
          <h1 className="text-4xl md:text-5xl font-bold text-black dark:text-white">
            Coming Soon
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400">
            We&apos;re working on something amazing!
          </p>
          <p className="text-gray-600 dark:text-gray-400">
            This page is under construction. Please check back later for updates.
          </p>
        </div>

        {/* Status Badge - Theme aware */}
        <div className="pt-4">
          <div className="inline-flex items-center px-6 py-3 rounded-md bg-gray-100 dark:bg-white/10 text-black dark:text-white font-medium transition-colors duration-300">
            <span className="relative flex h-3 w-3 mr-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-gray-400 dark:bg-white/75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-gray-600 dark:bg-white"></span>
            </span>
            Under Development
          </div>
        </div>

        {/* Social Media Links */}
        <div className="pt-8">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            In the meantime, you can follow us on social media or contact our team
          </p>
          <div className="flex justify-center space-x-6 pt-4">
            {socialLinks.map((social, index) => (
              <Link
                key={index}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                className="p-3 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 transition-all duration-300 transform hover:scale-110"
                aria-label={social.label}
                title={social.label}
              >
                <SimpleIcon
                  icon={social.icon}
                  size={24}
                  className="text-black dark:text-white transition-colors duration-300"
                />
              </Link>
            ))}
          </div>
        </div>

        {/* Footer Link - Theme aware */}
        <div className="pt-8">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            In the meantime, you can check out our
            <Link 
              href="/" 
              className="text-black dark:text-white hover:underline font-semibold ml-1 transition-colors duration-300"
            >
              homepage
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}