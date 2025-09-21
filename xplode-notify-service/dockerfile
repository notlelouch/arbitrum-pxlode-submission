# Use the official Golang image
FROM golang:1.20

# Set working directory
WORKDIR /app

# Copy go mod files first for better caching
COPY go.mod go.sum ./
RUN go mod download

# Copy the rest of the app
COPY . .

# Build the binary
RUN go build -o main .

# Expose port 8080 (used by Gin by default)
EXPOSE 8080

# Run the binary
CMD ["./main"]
