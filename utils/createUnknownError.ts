export default function createUnknownError(error: any): any {
  // Unknown error
  console.error(`Error name: ${error.name}`);
  console.error(error);
  return {
    statusCode: 500,
    statusMessage: "Unhandled error",
  };
}
