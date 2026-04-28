import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, MapPin, Phone, Send } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Contact Page
 * Design: Dynamic Sports Energy - Contact form and information
 */
export default function Contact() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Simulate form submission
    setTimeout(() => {
      toast.success('Message sent successfully! We will get back to you soon.');
      setFormData({ name: '', email: '', subject: '', message: '' });
      setIsSubmitting(false);
    }, 1000);
  };

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-blue-900 to-emerald-900 text-white py-16">
        <div className="container mx-auto px-4">
          <h1 className="text-5xl font-bold mb-4" style={{ fontFamily: 'Playfair Display, serif' }}>
            Get In Touch
          </h1>
          <p className="text-xl text-gray-200 max-w-2xl">
            Have questions about the club? Want to join or sponsor an event? We'd love to hear from you!
          </p>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-16">
            {/* Contact Info Cards */}
            <Card className="border-2 border-emerald-200 hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-emerald-600">
                  <Mail className="w-6 h-6" />
                  Email
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-gray-700 font-semibold">badminton@iisc.ac.in</p>
                <p className="text-gray-600 text-sm">
                  Send us an email and we'll respond within 24 hours.
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 border-orange-200 hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-orange-600">
                  <Phone className="w-6 h-6" />
                  Phone
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-gray-700 font-semibold">+91 (080) 2293 2000</p>
                <p className="text-gray-600 text-sm">
                  Call during office hours (Mon-Fri, 9 AM - 5 PM IST)
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 border-blue-900 hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-900">
                  <MapPin className="w-6 h-6" />
                  Location
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-gray-700 font-semibold">IISc Gymkhana</p>
                <p className="text-gray-600 text-sm">
                  Bangalore - 560012, India
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Contact Form */}
          <div className="max-w-2xl mx-auto">
            <h2 className="text-3xl font-bold text-blue-900 mb-8 text-center" style={{ fontFamily: 'Playfair Display, serif' }}>
              Send us a Message
            </h2>
            <form onSubmit={handleSubmit} className="bg-gradient-to-br from-blue-50 to-emerald-50 p-8 rounded-lg shadow-md border-2 border-emerald-200">
              <div className="space-y-6">
                {/* Name */}
                <div>
                  <label htmlFor="name" className="block text-sm font-semibold text-blue-900 mb-2">
                    Full Name
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                    placeholder="Your name"
                  />
                </div>

                {/* Email */}
                <div>
                  <label htmlFor="email" className="block text-sm font-semibold text-blue-900 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                    placeholder="your@email.com"
                  />
                </div>

                {/* Subject */}
                <div>
                  <label htmlFor="subject" className="block text-sm font-semibold text-blue-900 mb-2">
                    Subject
                  </label>
                  <select
                    id="subject"
                    name="subject"
                    value={formData.subject}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                  >
                    <option value="">Select a subject</option>
                    <option value="membership">Membership Inquiry</option>
                    <option value="coaching">Coaching Information</option>
                    <option value="events">Events & Tournaments</option>
                    <option value="sponsorship">Sponsorship</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                {/* Message */}
                <div>
                  <label htmlFor="message" className="block text-sm font-semibold text-blue-900 mb-2">
                    Message
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    required
                    rows={6}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white resize-none"
                    placeholder="Tell us more about your inquiry..."
                  />
                </div>

                {/* Submit Button */}
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-3 font-semibold flex items-center justify-center gap-2 transition-all duration-200"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5" />
                      Send Message
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 bg-gradient-to-r from-blue-50 to-emerald-50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-blue-900 mb-12 text-center" style={{ fontFamily: 'Playfair Display, serif' }}>
            Frequently Asked Questions
          </h2>
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-emerald-500">
              <h3 className="text-lg font-bold text-blue-900 mb-2">How do I join the club?</h3>
              <p className="text-gray-700">
                IISc students, faculty, and staff can join through the Gymkhana membership. Contact us for more details about the membership process.
              </p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-orange-500">
              <h3 className="text-lg font-bold text-blue-900 mb-2">What are the membership fees?</h3>
              <p className="text-gray-700">
                Membership fees vary based on your category (student, faculty, staff). Please contact us for current pricing information.
              </p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-blue-900">
              <h3 className="text-lg font-bold text-blue-900 mb-2">Do you offer coaching for beginners?</h3>
              <p className="text-gray-700">
                Yes! We offer coaching sessions for all skill levels, including beginners. Regular training camps are organized throughout the year.
              </p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-emerald-500">
              <h3 className="text-lg font-bold text-blue-900 mb-2">Can I participate in tournaments?</h3>
              <p className="text-gray-700">
                Absolutely! We organize regular friendly matches, inter-hostel tournaments, and participate in inter-college championships.
              </p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-orange-500">
              <h3 className="text-lg font-bold text-blue-900 mb-2">What equipment do I need?</h3>
              <p className="text-gray-700">
                Basic equipment like rackets and shuttlecocks are available at the club. You'll need badminton shoes and comfortable athletic wear.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Social Media Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-blue-900 mb-8 text-center" style={{ fontFamily: 'Playfair Display, serif' }}>
            Follow Us
          </h2>
          <div className="max-w-2xl mx-auto bg-gradient-to-r from-blue-900 to-emerald-900 text-white p-8 rounded-lg shadow-md text-center">
            <p className="mb-6">
              Stay updated with our latest events, photos, and announcements on social media.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Button className="bg-white text-blue-900 hover:bg-gray-100">Instagram</Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
