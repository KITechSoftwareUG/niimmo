
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, Mail, UserCheck } from "lucide-react";

interface MieterListProps {
  mieter: any[];
}

export const MieterList = ({ mieter }: MieterListProps) => {
  if (!mieter || mieter.length === 0) {
    return null;
  }

  return (
    <Card className="elegant-card border-0 shadow-lg rounded-2xl overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
        <CardTitle className="flex items-center space-x-3">
          <div className="p-2 bg-green-100 rounded-lg">
            <User className="h-5 w-5 text-green-600" />
          </div>
          <span className="text-xl font-semibold text-gray-800">Mieter</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-8">
        <div className="grid gap-6">
          {mieter.map((m, index) => (
            <div key={index} className="p-6 bg-gradient-to-br from-white to-gray-50 rounded-xl border border-gray-200 hover:shadow-md transition-all duration-200">
              <div className="flex justify-between items-start">
                <div className="flex items-start space-x-4">
                  <div className="p-3 bg-gradient-to-br from-blue-100 to-blue-200 rounded-full">
                    <UserCheck className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="space-y-3">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 mb-1">
                        {m.mieter?.Vorname} {m.mieter?.Nachname}
                      </h3>
                      {m.rolle && (
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                          {m.rolle}
                        </Badge>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      {m.mieter?.hauptmail && (
                        <div className="flex items-center space-x-2">
                          <Mail className="h-4 w-4 text-gray-500" />
                          <span className="text-gray-700 bg-gray-100 px-3 py-1 rounded-full text-sm">
                            {m.mieter.hauptmail}
                          </span>
                        </div>
                      )}
                      {m.mieter?.weitere_mails && (
                        <div className="flex items-center space-x-2">
                          <Mail className="h-4 w-4 text-gray-400" />
                          <span className="text-gray-600 bg-gray-50 px-3 py-1 rounded-full text-sm">
                            {m.mieter.weitere_mails}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
