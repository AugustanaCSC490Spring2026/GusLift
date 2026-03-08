export interface Ride {
  id: string;
  driverId: string;
  originBuilding: string;
  destinationBuilding: string;
  departureTime: string; // ISO string
  availableSeats: number;
  price: number;
  createdAt: string;
}
