import { Agenda, Job } from 'agenda';
import { RecommendationService } from '@services/recommendation.service';

/**
 * Defines the recommendation-related jobs for Agenda.
 * @param agenda - The Agenda instance.
 */
export const defineRecommendationJobs = (agenda: Agenda) => {
    agenda.define('initialize-recommendation-system', async (job: Job) => {
        try {
            console.log('[agenda]: Starting job: initialize-recommendation-system');
            await RecommendationService.initializeRecommendationSystem();
            console.log('[agenda]: Successfully processed job: initialize-recommendation-system');
        } catch (error) {
            console.error('[agenda]: Error in job initialize-recommendation-system:', error);
            throw error; // Re-throw the error to let Agenda handle retries/failures
        }
    });
};
