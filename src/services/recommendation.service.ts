import axios from 'axios';
import { config } from '@config/index';
import { AppError, ErrorCodes } from '@utils/appError';

export class RecommendationService {
    private static readonly RECOMMENDATION_API_URL = config.aiApi.recommendationApiUrl;

    /**
     * Initializes the recommendation system by calling the AI service.
     */
    static async initializeRecommendationSystem(): Promise<void> {
        if (!this.RECOMMENDATION_API_URL) {
            console.log('[recommendation.service]: Recommendation API URL not provided, skipping initialization.');
            return;
        }
        try {
            console.log('Initializing recommendation system...');
            const response = await axios.post(`${this.RECOMMENDATION_API_URL}/initialize_platform`, {
                device: 'cpu',
                data_path: 'recommendation/data/topics_mapping.json',
                model_config: 'recommendation/data/model_config_20250620_070646.json',
                num_content_items: 1000,
                num_topics: 35,
                num_users: 500,
                model_config_path: 'recommendation/data/model_config_20250620_070646.json',
                discussions_data_path: 'recommendation/data/discussions.csv',
                users_data_path: 'recommendation/data/users.csv',
            });

            if (response.data.status === 'success') {
                console.log('Recommendation system initialized successfully.');
            } else {
                throw new Error('Failed to initialize recommendation system: ' + response.data.message);
            }
        } catch (error) {
            throw new AppError(
                'Failed to initialize recommendation system',
                500,
                ErrorCodes.EXTERNAL_SERVICE_ERROR,
                error
            );
        }
    }

    /**
     * Gets personalized recommendations for a user.
     * This is a placeholder and currently returns an empty array.
     */
    static async getPersonalizedRecommendations(userId: string, selectedTopics: string[]): Promise<any[]> {
        if (!this.RECOMMENDATION_API_URL) {
            console.log('[recommendation.service]: Recommendation API URL not provided, skipping personalized recommendations.');
            return [];
        }

        console.log(`Fetching recommendations for user ${userId} with topics: ${selectedTopics.join(', ')}`);

        try {
            const response = await axios.post(`${this.RECOMMENDATION_API_URL}/recommend_personalized_platform`, {
                user_id: userId,
                selected_topics: selectedTopics,
                topic_weights: [1.0, 0.8], // Example weights, adjust as needed
                num_recommendations: 10,
            });

            if (response.data.status === 'success') {
                return response.data.recommendations;
            } else {
                console.error('Failed to get recommendations:', response.data.message);
                return [];
            }
        } catch (error) {
            console.error('Error fetching recommendations:', error);
            return [];
        }
    }
}
