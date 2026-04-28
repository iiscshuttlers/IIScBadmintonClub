import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, Clock, MapPin } from 'lucide-react';

/**
 * Facilities Page
 * Design: Dynamic Sports Energy - Showcase of club facilities and amenities
 */
export default function Facilities() {
  const facilities = [
    {
      title: 'Indoor Courts',
      description: 'Three professional-grade wooden courts with synthetic mat on wooden floors and modern lighting.',
      details: ['Wooden flooring with synthetic mat', 'Professional markings', 'LED lighting']
    },
  ];

  const schedule = [
    { day: 'Monday - Sunday', hours: '6:00 AM - 10:20 PM' },
    { day: 'Gymkhana Holidays', hours: 'Closed' },
  ];

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-blue-900 to-emerald-900 text-white py-16">
        <div className="container mx-auto px-4">
          <h1 className="text-5xl font-bold mb-4" style={{ fontFamily: 'Playfair Display, serif' }}>
            Our Facilities
          </h1>
          <p className="text-xl text-gray-200 max-w-2xl">
            World-class badminton facilities designed to support players at every level.
          </p>
        </div>
      </section>

      {/* Main Facilities */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto mb-16">
            {facilities.map((facility, idx) => (
              <Card key={idx} className="border-2 border-emerald-200 hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="text-blue-900 flex items-center gap-2">
                    <CheckCircle className="w-6 h-6 text-emerald-500" />
                    {facility.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-gray-700">{facility.description}</p>
                  <ul className="space-y-2">
                    {facility.details.map((detail, i) => (
                      <li key={i} className="flex gap-2 text-gray-600">
                        <span className="text-orange-500 font-bold">•</span>
                        {detail}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Operating Hours */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-blue-900 mb-12 text-center" style={{ fontFamily: 'Playfair Display, serif' }}>
            Operating Hours
          </h2>
          <div className="max-w-2xl mx-auto">
            <div className="space-y-4">
              {schedule.map((slot, idx) => (
                <div key={idx} className="bg-gradient-to-r from-blue-50 to-emerald-50 p-6 rounded-lg border-l-4 border-emerald-500">
                  <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                    <div className="font-bold text-blue-900 text-lg">{slot.day}</div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-5 h-5 text-emerald-500" />
                      <p className="font-semibold text-gray-800">{slot.hours}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Location */}
      <section className="py-16 bg-gradient-to-r from-emerald-50 to-orange-50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-blue-900 mb-12 text-center" style={{ fontFamily: 'Playfair Display, serif' }}>
            Location
          </h2>
          <div className="max-w-2xl mx-auto bg-white p-8 rounded-lg shadow-md">
            <div className="flex items-start gap-4 mb-6">
              <MapPin className="w-6 h-6 text-emerald-500 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-bold text-blue-900 text-lg mb-2">IISc Gymkhana Badminton Courts</h3>
                <p className="text-gray-700">
                  Indian Institute of Science<br />
                  Bangalore - 560012<br />
                  India
                </p>
              </div>
            </div>
            <p className="text-gray-600 text-sm">
              Located within the IISc campus, our courts are easily accessible to all members and visitors. The facility is equipped with ample parking and is well-connected by public transportation.
            </p>
          </div>
        </div>
      </section>

      {/* Membership Info */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-blue-900 mb-12 text-center" style={{ fontFamily: 'Playfair Display, serif' }}>
            Membership & Access
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto">
            <Card className="border-2 border-emerald-200">
              <CardHeader>
                <CardTitle className="text-emerald-600">IISc Members</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-gray-700">
                  Students, faculty, and staff of IISc have access to the facilities through the Gymkhana membership.
                </p>
                <ul className="space-y-2">
                  <li className="flex gap-2">
                    <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                    <span className="text-gray-600">Full facility access</span>
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                    <span className="text-gray-600">Coaching available</span>
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                    <span className="text-gray-600">Tournament participation</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
}
