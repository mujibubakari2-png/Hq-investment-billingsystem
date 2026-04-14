import Link from "next/link";
import { Facebook, Twitter, Instagram, Linkedin, Mail, Phone } from "lucide-react";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-primary text-white pt-20 pb-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
          <div className="space-y-6">
            <h3 className="text-2xl font-bold">HQInvestment <span className="text-secondary">Billing</span></h3>
            <p className="text-blue-100 leading-relaxed">
              Trusted by hundreds of ISPs across East Africa. We simplify billing so you can focus on connecting more customers.
            </p>
            <div className="flex space-x-4">
              <Link href="#" className="p-2 bg-accent rounded-lg hover:bg-secondary transition-colors"><Facebook size={20} /></Link>
              <Link href="#" className="p-2 bg-accent rounded-lg hover:bg-secondary transition-colors"><Twitter size={20} /></Link>
              <Link href="#" className="p-2 bg-accent rounded-lg hover:bg-secondary transition-colors"><Instagram size={20} /></Link>
              <Link href="#" className="p-2 bg-accent rounded-lg hover:bg-secondary transition-colors"><Linkedin size={20} /></Link>
            </div>
          </div>
          <div>
            <h4 className="text-xl font-bold mb-6">Quick Links</h4>
            <ul className="space-y-4">
              <li><Link href="/" className="text-blue-100 hover:text-white transition-colors">Home</Link></li>
              <li><Link href="#features" className="text-blue-100 hover:text-white transition-colors">Features</Link></li>
              <li><Link href="#pricing" className="text-blue-100 hover:text-white transition-colors">Pricing</Link></li>
              <li><Link href="#contact" className="text-blue-100 hover:text-white transition-colors">Contact</Link></li>
              <li><Link href={`${process.env.NEXT_PUBLIC_BILLING_SYSTEM_URL}/login`} className="text-blue-100 hover:text-white transition-colors">Login</Link></li>
              <li><Link href={`${process.env.NEXT_PUBLIC_BILLING_SYSTEM_URL}/register`} className="text-blue-100 hover:text-white transition-colors">Register</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-xl font-bold mb-6">Services</h4>
            <ul className="space-y-4">
              <li className="text-blue-100">Hotspot Voucher Billing</li>
              <li className="text-blue-100">PPPoE Subscriber Management</li>
              <li className="text-blue-100">MikroTik Auto-Provisioning</li>
              <li className="text-blue-100">SMS Payment Notifications</li>
              <li className="text-blue-100">Custom Voucher Portals</li>
            </ul>
          </div>
          <div>
            <h4 className="text-xl font-bold mb-6">Contact Us</h4>
            <ul className="space-y-4">
              <li className="flex items-center space-x-3 text-blue-100">
                <Mail size={18} />
                <span>support@hqinvestment.co.tz</span>
              </li>
              <li className="flex items-center space-x-3 text-blue-100">
                <Phone size={18} />
                <span>+255 700 000 001</span>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-accent pt-8 flex flex-col md:flex-row justify-between items-center text-blue-100 text-sm">
          <p>© {currentYear} HQInvestment Billing. All rights reserved.</p>
          <div className="flex space-x-6 mt-4 md:mt-0">
            <Link href="#" className="hover:text-white transition-colors">Privacy Policy</Link>
            <Link href="#" className="hover:text-white transition-colors">Terms of Service</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
