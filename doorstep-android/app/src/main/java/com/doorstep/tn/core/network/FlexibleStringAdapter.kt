package com.doorstep.tn.core.network

import com.squareup.moshi.FromJson
import com.squareup.moshi.JsonReader
import com.squareup.moshi.JsonWriter
import com.squareup.moshi.ToJson

/**
 * Moshi adapter that converts numeric JSON values to String.
 * Handles cases where the server returns numbers for decimal fields
 * but the Kotlin model expects String.
 */
class FlexibleStringAdapter {
    
    @FromJson
    @FlexibleString
    fun fromJson(reader: JsonReader): String? {
        return when (reader.peek()) {
            JsonReader.Token.NULL -> {
                reader.nextNull<Any>()
                null
            }
            JsonReader.Token.STRING -> reader.nextString()
            JsonReader.Token.NUMBER -> reader.nextString()
            JsonReader.Token.BOOLEAN -> reader.nextBoolean().toString()
            else -> {
                reader.skipValue()
                null
            }
        }
    }
    
    @ToJson
    fun toJson(writer: JsonWriter, @FlexibleString value: String?) {
        if (value == null) {
            writer.nullValue()
        } else {
            writer.value(value)
        }
    }
}

/**
 * Qualifier annotation for fields that should accept both String and Number from JSON
 */
@Retention(AnnotationRetention.RUNTIME)
@Target(AnnotationTarget.FIELD, AnnotationTarget.VALUE_PARAMETER, AnnotationTarget.FUNCTION)
annotation class FlexibleString
