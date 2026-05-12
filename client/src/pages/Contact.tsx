import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Mail, MapPin, Phone, Instagram } from 'lucide-react';
import { usePageMeta } from '@/hooks/usePageMeta';

export default function Contact() {
  usePageMeta({ title: 'Contact Us', description: 'Get in touch with the IISc Badminton Club. Find us at the IISc Gymkhana, Bangalore.' });
  return (
    <div className="min-h-screen">

      {/* Hero */}
      <section className="bg-gradient-to-r from-blue-900 to-emerald-900 text-white py-16">
        <div className="container mx-auto px-4 text-center">
          <h1
            className="text-5xl font-bold mb-4"
            style={{ fontFamily: 'Playfair Display, serif' }}
          >
            Get In Touch
          </h1>

          <p className="text-xl text-gray-200 max-w-3xl mx-auto">
            For memberships, coaching, tournaments, collaborations and club
            activities, feel free to connect with IISc Badminton Club.
          </p>
        </div>
      </section>

      {/* Contact Cards */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">

            <Card className="border-2 border-emerald-200 shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-emerald-600">
                  <Mail className="w-5 h-5" />
                  Email
                </CardTitle>
              </CardHeader>

              <CardContent>
                <p className="font-semibold text-gray-800">
                  office.gym@iisc.ac.in
                </p>
                <p className="text-sm text-gray-600 mt-2">
                  Best mode for membership and official queries.
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 border-orange-200 shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-orange-600">
                  <Phone className="w-5 h-5" />
                  Phone
                </CardTitle>
              </CardHeader>

              <CardContent>
                <p className="font-semibold text-gray-800">
                  +91 (080) 2293 xxxx
                </p>
                <p className="text-sm text-gray-600 mt-2">
                  IISc Main Contact
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 border-blue-200 shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-900">
                  <MapPin className="w-5 h-5" />
                  Location
                </CardTitle>
              </CardHeader>

              <CardContent>
                <p className="font-semibold text-gray-800">
                  Gymkhana Office, 2nd Floor, Janta Bazar, IISc
                </p>
                <p className="text-sm text-gray-600 mt-2">
                  Bengaluru - 560012, India
                </p>
              </CardContent>
            </Card>

          </div>

        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 bg-gradient-to-r from-blue-50 to-emerald-50">
        <div className="container mx-auto px-4">

          <h2
            className="text-3xl font-bold text-blue-900 mb-10 text-center"
            style={{ fontFamily: 'Playfair Display, serif' }}
          >
            Frequently Asked Questions
          </h2>

          <div className="max-w-4xl mx-auto space-y-5">

            <div className="bg-white p-6 rounded-xl shadow border-l-4 border-emerald-500">
              <h3 className="font-bold text-blue-900 mb-2">
                How do I join the club?
              </h3>
              <p className="text-gray-700">
                IISc students, faculty and staff can access facilities through
                Gymkhana membership.
              </p>
            </div>

            <div className="bg-white p-6 rounded-xl shadow border-l-4 border-orange-500">
              <h3 className="font-bold text-blue-900 mb-2">
                Do you offer coaching?
              </h3>
              <p className="text-gray-700">
                No. We do not provide coaching, but we have a vibrant community of players across all levels.
              </p>
            </div>

            <div className="bg-white p-6 rounded-xl shadow border-l-4 border-blue-500">
              <h3 className="font-bold text-blue-900 mb-2">
                Can I play tournaments?
              </h3>
              <p className="text-gray-700">
                Yes. Internal tournaments, open events and inter-department
                competitions are conducted regularly.
              </p>
            </div>

          </div>

        </div>
      </section>

      {/* Social */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">

          <div className="max-w-3xl mx-auto bg-gradient-to-r from-blue-900 to-emerald-900 text-white p-10 rounded-2xl shadow-lg text-center">

            <h2
              className="text-3xl font-bold mb-4"
              style={{ fontFamily: 'Playfair Display, serif' }}
            >
              Follow Us
            </h2>

            <p className="mb-6 text-gray-200">
              Stay updated with tournaments, match photos and announcements.
            </p>

            <a
              href="https://www.instagram.com/iisc.badminton/"
              target="_blank"
              rel="noreferrer"
            >
              <Button className="bg-white text-blue-900 hover:bg-gray-100 font-semibold px-6">
                <Instagram className="w-5 h-5 mr-2" />
                Instagram
              </Button>
            </a>

          </div>

        </div>
      </section>

    </div>
  );
}