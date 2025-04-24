import Joi from "joi";
import { Types } from "mongoose";

const objectId = Joi.string().custom((value, helpers) => {
    if (!Types.ObjectId.isValid(value)) {
        return helpers.error("any.invalid");
    }
    return value;
});

export const conversationValidation = {
    createGroup: {
        body: Joi.object().keys({
            name: Joi.string().required().min(3).max(50),
            description: Joi.string().max(200),
            participants: Joi.array().items(objectId).min(1).required(),
            type: Joi.string().valid("GroupDM").default("GroupDM"),
        }),
    },
};
