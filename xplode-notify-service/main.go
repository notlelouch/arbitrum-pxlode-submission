package main

import (
	"fmt"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/twilio/twilio-go"
	studio "github.com/twilio/twilio-go/rest/studio/v2"
)

// CORS middleware
func CORSMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Allow all origins
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		// Allow specific headers
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		// Allow specific methods
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")

		// Handle preflight request
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	}
}

func MakeCall() {
	accountSid := os.Getenv("TWILIO_ACCOUNT_SID")
	authToken := os.Getenv("TWILIO_AUTH_TOKEN")
	client := twilio.NewRestClientWithParams(twilio.ClientParams{
		Username: accountSid,
		Password: authToken,
	})
	params := &studio.CreateExecutionParams{}
	params.SetTo("+919981418999")
	params.SetFrom("+15076232796")
	resp, err := client.StudioV2.CreateExecution("FW994069543ef8a283608f841be641e03b", params)
	if err != nil {
		fmt.Println(err.Error())
		os.Exit(1)
	} else {
		if resp.Sid != nil {
			fmt.Println(*resp.Sid)
		} else {
			fmt.Println(resp.Sid)
		}
	}
}

func main() {
	fmt.Println("making phone call")

	router := gin.Default()

	// Apply CORS middleware globally
	router.Use(CORSMiddleware())

	router.GET("/matchmaking", func(c *gin.Context) {
		MakeCall()
		c.JSON(http.StatusOK, gin.H{
			"message": "phonecall made",
		})
	})

	router.Run()
}
